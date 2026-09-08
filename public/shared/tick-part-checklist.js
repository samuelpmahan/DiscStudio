/**
 * Framework-independent checklist for reviewing Tick/Part coverage.
 *
 * Usage:
 * <tick-part-checklist
 *   storage-key="my-review"
 *   data-checklist='[{"id":"tick-1","label":"Tick one","parts":[{"id":"part-a","label":"Part A"}]}]'>
 * </tick-part-checklist>
 */
(function () {
  'use strict';

  if (customElements.get('tick-part-checklist')) return;

  class TickPartChecklist extends HTMLElement {
    static get observedAttributes() {
      return ['data-checklist', 'storage-key'];
    }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._state = null;
      this._checklist = [];
      this._storageKey = '';
      this._storagePrefix = 'tick-part-checklist:';
    }

    connectedCallback() {
      this._readAttributes();
      this._render();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue || !this.isConnected) return;
      this._readAttributes();
      this._render();
    }

    _readAttributes() {
      this._checklist = this._parseChecklist(this.getAttribute('data-checklist'));
      this._storageKey = this.getAttribute('storage-key') || 'default';
      this._state = this._loadState();
    }

    _parseChecklist(raw) {
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((tick) => tick && tick.id != null).map((tick) => ({
          id: String(tick.id),
          label: tick.label == null ? String(tick.id) : String(tick.label),
          parts: Array.isArray(tick.parts)
            ? tick.parts.filter((part) => part && part.id != null).map((part) => ({
              id: String(part.id),
              label: part.label == null ? String(part.id) : String(part.label)
            }))
            : []
        }));
      } catch (_) {
        return [];
      }
    }

    _storage() {
      try {
        return window.localStorage;
      } catch (_) {
        return null;
      }
    }

    _loadState() {
      const initial = { ticks: {}, parts: {}, collapsed: true };
      const storage = this._storage();
      if (!storage) return initial;
      try {
        const value = JSON.parse(storage.getItem(this._storagePrefix + this._storageKey));
        if (!value || typeof value !== 'object') return initial;
        return {
          ticks: value.ticks && typeof value.ticks === 'object' ? value.ticks : {},
          parts: value.parts && typeof value.parts === 'object' ? value.parts : {},
          collapsed: value.collapsed !== false
        };
      } catch (_) {
        return initial;
      }
    }

    _saveState() {
      const storage = this._storage();
      if (!storage) return;
      try {
        storage.setItem(this._storagePrefix + this._storageKey, JSON.stringify(this._state));
      } catch (_) {
        // Persistence is best effort when storage is unavailable or full.
      }
    }

    _safeId(kind, tickId, partId) {
      const value = [kind, tickId, partId].filter((item) => item != null).join('--');
      return 'tick-part-checklist-' + encodeURIComponent(value).replace(/%/g, '_');
    }

    _partChecked(tickId, partId) {
      return Boolean(this._state.parts[tickId] && this._state.parts[tickId][partId]);
    }

    _tickSummary(tick) {
      const total = tick.parts.length;
      const checked = tick.parts.reduce((count, part) => count + (this._partChecked(tick.id, part.id) ? 1 : 0), 0);
      return { total, checked };
    }

    _setTick(tick, checked) {
      this._state.ticks[tick.id] = checked;
      if (!this._state.parts[tick.id]) this._state.parts[tick.id] = {};
      tick.parts.forEach((part) => { this._state.parts[tick.id][part.id] = checked; });
      this._saveState();
      this._render();
    }

    _setPart(tick, part, checked) {
      if (!this._state.parts[tick.id]) this._state.parts[tick.id] = {};
      this._state.parts[tick.id][part.id] = checked;
      const summary = this._tickSummary(tick);
      this._state.ticks[tick.id] = summary.total > 0 && summary.checked === summary.total;
      this._saveState();
      this._render();
    }

    _render() {
      if (!this.shadowRoot || !this._state) return;
      const focusedId = this.shadowRoot.activeElement && this.shadowRoot.activeElement.id;
      const collapsed = this._state.collapsed;
      const ticksMarkup = this._checklist.map((tick) => {
        const summary = this._tickSummary(tick);
        const tickInputId = this._safeId('tick', tick.id);
        const checked = summary.total > 0 ? summary.checked === summary.total : Boolean(this._state.ticks[tick.id]);
        const partsMarkup = tick.parts.map((part) => {
          const partInputId = this._safeId('part', tick.id, part.id);
          return '<li><label for="' + partInputId + '"><input type="checkbox" id="' + partInputId + '" data-tick-id="' + this._escape(tick.id) + '" data-part-id="' + this._escape(part.id) + '"' + (this._partChecked(tick.id, part.id) ? ' checked' : '') + '> <span>' + this._escape(part.label) + '</span></label></li>';
        }).join('');
        return '<li class="tick"><label class="tick-label" for="' + tickInputId + '"><input type="checkbox" id="' + tickInputId + '" data-tick-id="' + this._escape(tick.id) + '" data-tick-toggle' + (checked ? ' checked' : '') + '> <span>' + this._escape(tick.label) + '</span></label>' + (tick.parts.length ? '<ul class="parts">' + partsMarkup + '</ul>' : '') + '</li>';
      }).join('');

      this.shadowRoot.innerHTML = '<style>' + this._styles() + '</style>' +
        '<div class="widget ' + (collapsed ? 'is-collapsed' : '') + '">' +
        '<button type="button" id="checklist-reopen" class="reopen" aria-label="Open checklist"' + (collapsed ? '' : ' hidden') + '>Checklist</button>' +
        '<section class="panel" aria-label="Your checklist"' + (collapsed ? ' hidden' : '') + '>' +
        '<div class="header"><h2>Your checklist</h2><button type="button" id="checklist-hide" class="hide" aria-label="Hide checklist">Hide</button></div>' +
        (this._checklist.length ? '<ul class="ticks">' + ticksMarkup + '</ul>' : '<p class="empty">No checklist items.</p>') +
        '</section></div>';

      this.shadowRoot.querySelector('.reopen').addEventListener('click', () => {
        this._state.collapsed = false; this._saveState(); this._render();
        this.shadowRoot.getElementById('checklist-hide')?.focus();
      });
      this.shadowRoot.querySelector('.hide').addEventListener('click', () => {
        this._state.collapsed = true; this._saveState(); this._render();
        this.shadowRoot.getElementById('checklist-reopen')?.focus();
      });
      this.shadowRoot.querySelectorAll('[data-tick-toggle]').forEach((input) => {
        input.addEventListener('change', () => {
          const tick = this._checklist.find((item) => item.id === input.dataset.tickId);
          if (tick) this._setTick(tick, input.checked);
        });
        const tick = this._checklist.find((item) => item.id === input.dataset.tickId);
        if (tick) {
          const summary = this._tickSummary(tick);
          input.indeterminate = summary.checked > 0 && summary.checked < summary.total;
        }
      });
      this.shadowRoot.querySelectorAll('[data-part-id]').forEach((input) => {
        input.addEventListener('change', () => {
          const tick = this._checklist.find((item) => item.id === input.dataset.tickId);
          const part = tick && tick.parts.find((item) => item.id === input.dataset.partId);
          if (tick && part) this._setPart(tick, part, input.checked);
        });
      });
      if (focusedId) this.shadowRoot.getElementById(focusedId)?.focus();
    }

    _escape(value) {
      return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    _styles() {
      return ':host{position:fixed;right:12px;bottom:12px;z-index:1000;display:block;box-sizing:border-box;width:min(360px,calc(100vw - 24px));max-width:calc(100vw - 24px);pointer-events:none;font:14px/1.4 system-ui,-apple-system,sans-serif;color:#1f2937}.widget{width:100%;box-sizing:border-box;pointer-events:auto;background:#fff;border:1px solid #d1d5db;border-radius:8px;box-shadow:0 2px 8px #00000012;overflow:hidden}.widget.is-collapsed{width:max-content;margin-left:auto}.panel{max-height:min(440px,calc(100vh - 80px));overflow:auto}.reopen,.hide{font:inherit;cursor:pointer;border:1px solid #9ca3af;background:#f9fafb;color:#374151;border-radius:5px;padding:3px 8px}.reopen{font-size:12px;margin:4px}.reopen:focus-visible,.hide:focus-visible,input:focus-visible{outline:2px solid #2563eb;outline-offset:2px}.header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border-bottom:1px solid #e5e7eb}.header h2{font-size:14px;margin:0;font-weight:650}.hide{font-size:12px}.ticks,.parts{list-style:none;padding:0;margin:0}.ticks{padding:5px 10px 8px}.tick{padding:5px 0}.tick-label,.parts label{display:flex;align-items:flex-start;gap:7px;cursor:pointer}.tick-label{font-weight:600}.parts{padding:2px 0 0 25px}.parts li{padding:3px 0;font-weight:400}.parts input,.tick-label input{flex:none;margin-top:3px}.empty{padding:8px 10px;color:#6b7280;margin:0}@media(max-width:260px){.header{align-items:flex-start;flex-direction:column}.parts{padding-left:20px}}';
    }
  }

  customElements.define('tick-part-checklist', TickPartChecklist);
}());
