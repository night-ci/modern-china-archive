(function () {
  var search = document.getElementById('search');
  if (search) {
    var scope = document.querySelector('.timeline') || document.querySelector('.grid');
    var empty = document.getElementById('empty');
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-search]'));
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      var visible = 0;
      items.forEach(function (el) {
        var hit = !q || (el.getAttribute('data-search') || '').toLowerCase().indexOf(q) !== -1;
        el.hidden = !hit;
        if (hit) visible++;
      });
      if (empty) empty.hidden = visible !== 0;
      document.querySelectorAll('.period-block').forEach(function (block) {
        var rows = block.querySelectorAll('[data-search]');
        var any = Array.prototype.some.call(rows, function (r) { return !r.hidden; });
        block.hidden = !any;
      });
    });
  }

  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var done = function () {
        var old = btn.textContent;
        btn.textContent = '已复制';
        setTimeout(function () { btn.textContent = old; }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
        done();
      }
    });
  });
})();
