(function () {
  var rows = Array.prototype.slice.call(document.querySelectorAll('.tl-row'));
  var periods = Array.prototype.slice.call(document.querySelectorAll('.tl-period'));
  var years = Array.prototype.slice.call(document.querySelectorAll('.tl-year'));
  var search = document.getElementById('timelineSearch');
  var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-tl-period]'));
  var count = document.getElementById('timelineCount');
  var empty = document.getElementById('timelineEmpty');
  var period = 'all';

  function apply() {
    var q = search ? search.value.trim().toLowerCase() : '';
    var visible = 0;
    rows.forEach(function (el) {
      var okPeriod = period === 'all' || el.getAttribute('data-period') === period;
      var okQuery = !q || (el.getAttribute('data-search') || '').toLowerCase().indexOf(q) !== -1;
      var show = okPeriod && okQuery;
      el.hidden = !show;
      if (show) visible++;
    });
    years.forEach(function (y) {
      y.hidden = !y.querySelector('.tl-row:not([hidden])');
    });
    periods.forEach(function (p) {
      p.hidden = !p.querySelector('.tl-row:not([hidden])');
    });
    if (count) count.textContent = '共 ' + visible + ' 条';
    if (empty) empty.hidden = visible !== 0;
  }

  if (search) search.addEventListener('input', apply);
  var jump = document.getElementById('timelineYearJump');
  if (jump) jump.addEventListener('change', function () {
    if (!jump.value) return;
    var target = document.getElementById(jump.value);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      buttons.forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      period = btn.getAttribute('data-tl-period');
      apply();
    });
  });

  apply();
})();
