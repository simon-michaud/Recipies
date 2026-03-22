(function () {
  'use strict';

  var UNICODE_FRACS = {
    '\u00bd': 1/2, '\u00bc': 1/4, '\u00be': 3/4,
    '\u2153': 1/3, '\u2154': 2/3,
    '\u215b': 1/8, '\u215c': 3/8, '\u215d': 5/8, '\u215e': 7/8
  };

  var NICE_FRACS = [
    [1,8],[1,4],[1,3],[3,8],[1,2],[5,8],[2,3],[3,4],[7,8]
  ];

  var UNICODE_OUT = {
    '1/2':'\u00bd','1/4':'\u00bc','3/4':'\u00be',
    '1/3':'\u2153','2/3':'\u2154',
    '1/8':'\u215b','3/8':'\u215c','5/8':'\u215d','7/8':'\u215e'
  };

  // Try patterns in order of specificity
  var PATTERNS = [
    /^(\d+\s+\d+\/\d+)/,           // mixed: "1 1/4"
    /^(\d+\/\d+)/,                  // fraction: "2/3"
    /^(\d+\.?\d*[½¼¾⅓⅔⅛⅜⅝⅞])/,    // decimal+unicode: "1½"
    /^([½¼¾⅓⅔⅛⅜⅝⅞])/,             // just unicode: "¼"
    /^(\d+\.?\d*)/                  // decimal/integer: "1.5", "15"
  ];

  function parseQty(str) {
    str = str.trim();
    var matched = '';
    for (var i = 0; i < PATTERNS.length; i++) {
      var m = str.match(PATTERNS[i]);
      if (m) { matched = m[1]; break; }
    }
    if (!matched) return { value: null, matched: '' };

    var val = 0;
    var s = matched;

    // Extract unicode fraction chars
    for (var ch in UNICODE_FRACS) {
      if (s.indexOf(ch) !== -1) {
        val += UNICODE_FRACS[ch];
        s = s.replace(ch, '').trim();
      }
    }

    if (s) {
      var mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
      if (mixed) {
        val += parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
      } else {
        var frac = s.match(/^(\d+)\/(\d+)$/);
        if (frac) {
          val += parseInt(frac[1]) / parseInt(frac[2]);
        } else {
          var n = parseFloat(s);
          if (!isNaN(n)) val += n;
        }
      }
    }

    return { value: val, matched: matched };
  }

  function formatQty(val, origStr) {
    if (val <= 0) return '0';

    var usesUnicode = /[½¼¾⅓⅔⅛⅜⅝⅞]/.test(origStr);
    var whole = Math.floor(val);
    var frac = val - whole;
    var fracStr = '';

    if (frac > 0.01) {
      for (var i = 0; i < NICE_FRACS.length; i++) {
        var n = NICE_FRACS[i][0], d = NICE_FRACS[i][1];
        if (Math.abs(frac - n / d) < 0.02) {
          fracStr = n + '/' + d;
          break;
        }
      }
    }

    // Can't express as a nice fraction — use decimal
    if (frac > 0.01 && !fracStr) {
      return (Math.round(val * 100) / 100).toString();
    }

    if (fracStr) {
      if (usesUnicode && UNICODE_OUT[fracStr]) {
        var uf = UNICODE_OUT[fracStr];
        return whole > 0 ? (whole + uf) : uf;
      }
      return whole > 0 ? (whole + ' ' + fracStr) : fracStr;
    }

    return whole.toString();
  }

  function applyMultiplier(multiplier) {
    var spans = document.querySelectorAll('.recipe-qty');
    for (var i = 0; i < spans.length; i++) {
      var span = spans[i];
      if (multiplier === 1) {
        span.textContent = span.getAttribute('data-original-str');
      } else {
        var orig = parseFloat(span.getAttribute('data-original'));
        var origStr = span.getAttribute('data-original-str');
        span.textContent = formatQty(orig * multiplier, origStr);
      }
    }
  }

  function init() {
    // Find the Ingredients heading
    var headings = document.querySelectorAll('h2');
    var ingHeading = null;
    for (var i = 0; i < headings.length; i++) {
      if (/^ingredients$/i.test(headings[i].textContent.trim())) {
        ingHeading = headings[i];
        break;
      }
    }
    if (!ingHeading) return;

    // Find the next list after the heading
    var list = ingHeading.nextElementSibling;
    while (list && list.tagName !== 'UL' && list.tagName !== 'OL') {
      list = list.nextElementSibling;
    }
    if (!list) return;

    // Wrap quantity tokens in spans
    var hasQty = false;
    var items = list.querySelectorAll('li');
    for (var j = 0; j < items.length; j++) {
      var li = items[j];
      var node = li.firstChild;
      if (!node || node.nodeType !== Node.TEXT_NODE) continue;

      var text = node.textContent;
      var result = parseQty(text);
      if (result.value === null) continue;

      hasQty = true;
      var rest = text.slice(result.matched.length);

      // Detect ranges like "2 to 6 chilies" or "1-2 tbsp"
      var rangeMatch = rest.match(/^(\s+to\s+|-(?=\d))/);
      var result2 = rangeMatch ? parseQty(rest.slice(rangeMatch[0].length)) : null;
      if (result2 && result2.value === null) result2 = null;

      if (result2) {
        var separator = rangeMatch[0];
        var remaining = rest.slice(separator.length + result2.matched.length);

        // Build: [span1][separator text][span2][remaining text]
        node.textContent = remaining;

        var span2 = document.createElement('span');
        span2.className = 'recipe-qty';
        span2.setAttribute('data-original', result2.value);
        span2.setAttribute('data-original-str', result2.matched);
        span2.textContent = result2.matched;
        li.insertBefore(span2, node);

        li.insertBefore(document.createTextNode(separator), span2);

        var span1 = document.createElement('span');
        span1.className = 'recipe-qty';
        span1.setAttribute('data-original', result.value);
        span1.setAttribute('data-original-str', result.matched);
        span1.textContent = result.matched;
        li.insertBefore(span1, span2.previousSibling);
      } else {
        node.textContent = rest;
        var span = document.createElement('span');
        span.className = 'recipe-qty';
        span.setAttribute('data-original', result.value);
        span.setAttribute('data-original-str', result.matched);
        span.textContent = result.matched;
        li.insertBefore(span, node);
      }
    }

    if (!hasQty) return;

    // Build multiplier UI
    var ui = document.createElement('div');
    ui.className = 'recipe-multiplier';
    ui.innerHTML =
      '<span class="recipe-mult-label">Multiply recipe:</span>' +
      '<div class="mult-buttons">' +
        '<button class="mult-btn" data-mult="0.5">&frac12;&times;</button>' +
        '<button class="mult-btn active" data-mult="1">1&times;</button>' +
        '<button class="mult-btn" data-mult="2">2&times;</button>' +
        '<button class="mult-btn" data-mult="3">3&times;</button>' +
        '<button class="mult-btn" data-mult="4">4&times;</button>' +
      '</div>' +
      '<input type="number" class="mult-input" value="1" min="0.1" max="99" step="0.5" aria-label="Custom multiplier">';

    ingHeading.parentNode.insertBefore(ui, ingHeading);

    var multInput = ui.querySelector('.mult-input');
    var buttons = ui.querySelectorAll('.mult-btn');

    function setMultiplier(mult) {
      for (var k = 0; k < buttons.length; k++) {
        buttons[k].classList.remove('active');
        if (parseFloat(buttons[k].getAttribute('data-mult')) === mult) {
          buttons[k].classList.add('active');
        }
      }
      applyMultiplier(mult);
    }

    for (var k = 0; k < buttons.length; k++) {
      (function(btn) {
        btn.addEventListener('click', function () {
          var mult = parseFloat(btn.getAttribute('data-mult'));
          multInput.value = mult;
          setMultiplier(mult);
        });
      })(buttons[k]);
    }

    multInput.addEventListener('input', function () {
      var mult = parseFloat(multInput.value);
      if (!isNaN(mult) && mult > 0) setMultiplier(mult);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
