/* Tiny renderer for the page template: {{holes}}, <sc-for>, <sc-if>, data-on-* events.
   Re-renders by diffing with morphdom so sliders keep working while dragged. */
(function () {
  'use strict';
  function DCLogic(props) { this.props = props || {}; }
  DCLogic.prototype.setState = function (o) {
    if (typeof o === 'function') o = o(this.state);
    Object.assign(this.state, o);
    schedule();
  };
  DCLogic.prototype.forceUpdate = function () { schedule(); };
  window.DCLogic = DCLogic;

  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g, WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true; if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var parts = path.split('.'), v = scope;
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  function interp(str, scope) { return str.replace(HOLE, function (_, p) { var v = lookup(p, scope); return v == null ? '' : String(v); }); }

  var handlers, hid, comp, tpl, root, pending = false;
  function reg(fn) { var k = 'h' + (hid++); handlers[k] = fn; return k; }

  function build(node, scope, out) {
    if (node.nodeType === 3) { out.appendChild(document.createTextNode(interp(node.nodeValue, scope))); return; }
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    if (tag === 'sc-if') {
      var cond = lookup(WHOLE.exec(node.getAttribute('value'))[1], scope);
      if (cond) node.childNodes.forEach(function (c) { build(c, scope, out); });
      return;
    }
    if (tag === 'sc-for') {
      var list = lookup(WHOLE.exec(node.getAttribute('list'))[1], scope) || [], as = node.getAttribute('as') || 'item';
      list.forEach(function (it, i) {
        var s = Object.create(scope); s[as] = it; s.$index = i;
        node.childNodes.forEach(function (c) { build(c, s, out); });
      });
      return;
    }
    var el = node.namespaceURI === 'http://www.w3.org/2000/svg' ? document.createElementNS(node.namespaceURI, tag) : document.createElement(tag);
    for (var i = 0; i < node.attributes.length; i++) {
      var a = node.attributes[i], name = a.name, val = a.value;
      if (name.indexOf('hint-') === 0) continue;
      if (name.indexOf('data-on-') === 0) {
        var m = WHOLE.exec(val); var fn = m ? lookup(m[1], scope) : null;
        if (typeof fn === 'function') el.setAttribute(name, reg(fn));
        continue;
      }
      var w = WHOLE.exec(val);
      if (w) { var v = lookup(w[1], scope); if (v === false || v == null) continue; el.setAttribute(name, v === true ? '' : String(v)); }
      else el.setAttribute(name, interp(val, scope));
    }
    var kids = node.content ? node.content.childNodes : node.childNodes;
    kids.forEach(function (c) { build(c, scope, el); });
    out.appendChild(el);
  }

  function render() {
    pending = false; handlers = {}; hid = 0;
    var vals = comp.renderVals();
    var next = document.createElement('div'); next.id = 'app';
    tpl.content.childNodes.forEach(function (c) { build(c, vals, next); });
    morphdom(root, next, {
      onBeforeElUpdated: function (from, to) {
        if (from === document.activeElement && from.tagName === 'INPUT' && from.type === 'text') { to.value = from.value; }
        if (from.tagName === 'DETAILS') { if (from.open) to.setAttribute('open', ''); else to.removeAttribute('open'); }
        return true;
      }
    });
  }
  function schedule() { if (!pending) { pending = true; requestAnimationFrame(render); } }

  function fire(type, e) {
    var t = e.target.closest ? e.target.closest('[data-on-' + type + ']') : null;
    if (!t) return; var fn = handlers[t.getAttribute('data-on-' + type)];
    if (fn) fn(e);
  }
  window.mountPage = function (Component) {
    tpl = document.getElementById('page-template'); root = document.getElementById('app');
    comp = new Component({});
    document.addEventListener('click', function (e) { fire('click', e); });
    document.addEventListener('input', function (e) { fire('input', e); });
    render();
    if (comp.componentDidMount) comp.componentDidMount();
  };
})();
