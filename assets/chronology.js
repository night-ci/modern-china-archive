(function () {
  var items = Array.prototype.slice.call(document.querySelectorAll('.chron-item'));
  var years = Array.prototype.slice.call(document.querySelectorAll('.chron-year'));
  var search = document.getElementById('chronSearch');
  var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-chron-period]'));
  var count = document.getElementById('chronCount');
  var empty = document.getElementById('chronEmpty');
  var jump = document.getElementById('yearJump');
  var period = 'all';

  function apply() {
    var q = search ? search.value.trim().toLowerCase() : '';
    var visible = 0;
    items.forEach(function (el) {
      var okPeriod = period === 'all' || el.getAttribute('data-period') === period;
      var okQuery = !q || (el.getAttribute('data-search') || '').toLowerCase().indexOf(q) !== -1;
      var show = okPeriod && okQuery;
      el.hidden = !show;
      if (show) visible++;
    });
    years.forEach(function (y) {
      y.hidden = !y.querySelector('.chron-item:not([hidden])');
    });
    if (count) count.textContent = '共 ' + visible + ' 条';
    if (empty) empty.hidden = visible !== 0;
  }

  if (search) search.addEventListener('input', apply);

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      buttons.forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      period = btn.getAttribute('data-chron-period');
      apply();
    });
  });

  if (jump) {
    jump.addEventListener('change', function () {
      if (!jump.value) return;
      var target = document.getElementById(jump.value);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  apply();
})();
