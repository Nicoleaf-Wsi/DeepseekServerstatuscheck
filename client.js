window.__ModuleLoader__.load({
  id: '@local/deepseek-availability',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const POLL_MS = 60 * 1000;
    const ROUTE = '/deepseek-availability';

    /** Poll the Host route and fold the result into a small render state. */
    function useAvailability() {
      const [snapshot, setSnapshot] = React.useState({ phase: 'checking' });
      const [refreshing, setRefreshing] = React.useState(false);
      const checkRef = React.useRef(null);

      React.useEffect(() => {
        let disposed = false;
        let inFlight = false;

        async function check() {
          if (inFlight) return;
          inFlight = true;
          setRefreshing(true);
          try {
            const res = await fetch(ROUTE, { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (!disposed) setSnapshot({ phase: 'ready', data });
          } catch (error) {
            const message = error && error.message ? error.message : String(error);
            if (!disposed) setSnapshot({ phase: 'error', error: message });
          } finally {
            inFlight = false;
            if (!disposed) setRefreshing(false);
          }
        }

        checkRef.current = check;
        check();
        const timer = setInterval(check, POLL_MS);
        return () => {
          disposed = true;
          clearInterval(timer);
          checkRef.current = null;
        };
      }, []);

      const refresh = () => {
        if (checkRef.current) checkRef.current();
      };

      return { snapshot, refreshing, refresh };
    }

    function Dot(props) {
      const cls =
        props.ok === undefined
          ? 'dsa-dot-checking'
          : props.ok
            ? 'dsa-dot-ok'
            : 'dsa-dot-down';
      return h('span', { className: 'dsa-dot ' + cls, 'aria-hidden': true });
    }

    function RefreshIcon() {
      return h(
        'svg',
        { className: 'dsa-refresh-icon', viewBox: '0 0 24 24', width: 12, height: 12, 'aria-hidden': true },
        h('polyline', { points: '23 4 23 10 17 10' }),
        h('path', { d: 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10' }),
      );
    }

    function Badge(props) {
      const { snapshot, refreshing, refresh } = useAvailability();
      const data = snapshot.data;

      const api =
        data && Array.isArray(data.endpoints)
          ? data.endpoints.find((e) => e.id === 'api')
          : undefined;

      const overallOk = data ? data.available : undefined;

      const title =
        snapshot.phase === 'error'
          ? 'check failed: ' + snapshot.error
          : data
            ? JSON.stringify(data, null, 2)
            : 'checking…';

      const models = data && Array.isArray(data.models) ? data.models : [];

      const style = h(
        'style',
        null,
        [
          '.dsa-root{display:flex;flex-direction:column;gap:4px;width:100%;box-sizing:border-box;',
          'padding:6px 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);',
          'background:var(--dsw-alias-bg-layer-1);font-size:11px;line-height:1.4;font-family:inherit;',
          'color:var(--dsw-alias-label-secondary);}',
          '.dsa-header{display:flex;align-items:center;gap:5px;color:var(--dsw-alias-label-primary);}',
          '.dsa-title{font-weight:600;color:var(--dsw-alias-label-primary);}',
          '.dsa-header-status{color:var(--dsw-alias-label-secondary);}',
          '.dsa-dot{width:7px;height:7px;border-radius:50%;flex:0 0 auto;}',
          '.dsa-dot-checking{background:var(--dsw-alias-state-idle-primary);}',
          '.dsa-dot-ok{background:var(--dsw-alias-state-success-primary);}',
          '.dsa-dot-down{background:var(--dsw-alias-state-error-primary);}',
          '.dsa-rail{display:flex;justify-content:center;align-items:center;width:100%;}',
          '.dsa-models{display:flex;flex-direction:column;gap:2px;padding-left:12px;}',
          '.dsa-model{display:flex;align-items:center;gap:5px;}',
          '.dsa-model-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);}',
          '.dsa-model-status{flex:none;color:var(--dsw-alias-label-secondary);}',
          '.dsa-refresh{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;',
          'border-radius:4px;color:var(--dsw-alias-label-secondary);background:none;border:none;cursor:pointer;padding:0;flex:none;}',
          '@media (hover:hover){.dsa-refresh:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}}',
          '.dsa-refresh:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}',
          '.dsa-refresh-icon{display:block;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}',
          '.dsa-refresh-spin .dsa-refresh-icon{animation:dsa-spin .8s linear infinite;}',
          '@keyframes dsa-spin{to{transform:rotate(360deg)}}',
        ].join(''),
      );

      // Collapsed rail: show only the status dot.
      if (props.wide === false) {
        return h(
          'div',
          { className: 'dsa-rail', title },
          style,
          h(Dot, { ok: snapshot.phase === 'checking' ? undefined : overallOk }),
        );
      }

      const headerText =
        snapshot.phase === 'checking'
          ? 'checking…'
          : snapshot.phase === 'error'
            ? 'unavailable'
            : overallOk
              ? api && typeof api.latencyMs === 'number'
                ? `${api.latencyMs} ms`
                : 'available'
              : 'unavailable';

      return h(
        'div',
        { className: 'dsa-root', title },
        style,
        h(
          'div',
          { className: 'dsa-header' },
          h(Dot, { ok: snapshot.phase === 'checking' ? undefined : overallOk }),
          h('span', { className: 'dsa-title' }, 'DeepSeek'),
          h('span', { className: 'dsa-header-status' }, headerText),
          h(
            'button',
            {
              className: 'dsa-refresh' + (refreshing ? ' dsa-refresh-spin' : ''),
              type: 'button',
              'aria-label': 'Refresh',
              title: 'Refresh',
              onClick: refresh,
            },
            h(RefreshIcon),
          ),
        ),
        models.length > 0 &&
          h(
            'div',
            { className: 'dsa-models' },
            models.map((m) =>
              h(
                'div',
                { className: 'dsa-model', key: m.id },
                h(Dot, { ok: m.available }),
                h('span', { className: 'dsa-model-name' }, m.name || m.id),
                h(
                  'span',
                  { className: 'dsa-model-status' },
                  m.available ? 'available' : 'unavailable',
                ),
              ),
            ),
          ),
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('sidebar.footer.action', () =>
          ctx.slots.register(
            {
              name: 'sidebar.footer.action',
              id: 'deepseek-availability',
              order: 5,
            },
            Badge,
          ),
        );
      },
    };
  },
});
