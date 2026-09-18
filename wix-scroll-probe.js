/* ============================================================================
 * orbiters-scroll-probe
 * Wix 커스텀 엘리먼트 안에서 GSAP / ScrollTrigger / Lenis 가 실제로 동작하는지
 * 확인하는 진단용 웹 컴포넌트.
 *
 * ▣ 넣는 곳 — 미디어 관리자 아님!
 *   1. Wix Studio 에서 왼쪽 사이드바의 코드 아이콘 ( </> ) → "Start Coding"
 *   2. Code 사이드바의 Public & Backend 영역 → public 폴더 안
 *      custom-elements 폴더에 새 파일 만들기 (+ 아이콘)
 *      경로: public/custom-elements/wix-scroll-probe.js
 *      ※ 업로드가 아니라 "새 파일 생성" 후 이 내용을 통째로 붙여넣기
 *   3. 요소 추가 → Embed & Social → Custom Element 배치
 *   4. Choose Source → Velo file → 방금 만든 파일 선택
 *   5. Tag Name 에 정확히:  orbiters-scroll-probe
 *   6. ★ 게시(Publish) 후 실제 사이트 주소에서 확인 ★
 *      에디터·미리보기에서는 커스텀 엘리먼트가 iframe 안에서 돌기 때문에
 *      결과가 실제와 다르게 나옵니다. 진단판 첫 줄이 이걸 알려줍니다.
 *
 * 판정 기준은 파일 맨 아래 주석 참고.
 * ========================================================================== */

const OSP_CDN = {
  gsap:  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js',
  st:    'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollTrigger.min.js',
  lenis: 'https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.min.js'
};

const OSP_ROWS = [
  ['frame',    '실행 위치'],
  ['gsap',     'GSAP 로드'],
  ['st',       'ScrollTrigger 로드'],
  ['scroller', '스크롤 주체'],
  ['fire',     'ScrollTrigger 발화'],
  ['pin',      'pin 동작'],
  ['height',   '문서 높이 변화'],
  ['lenis',    'Lenis']
];

const OSP_CSS = `
.osp{display:block;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Pretendard","Apple SD Gothic Neo",sans-serif;color:#1a1a1a}
.osp *{box-sizing:border-box}
.osp__panel{position:sticky;top:0;z-index:5;background:#fff;border:1px solid rgba(0,0,0,.16);border-radius:12px;padding:14px 16px;box-shadow:0 10px 30px -22px rgba(0,0,0,.6)}
.osp__title{font-weight:700;font-size:15px;margin:0 0 10px}
.osp__row{display:flex;gap:10px;align-items:flex-start;padding:6px 0;border-top:1px solid rgba(0,0,0,.07)}
.osp__row:first-of-type{border-top:0}
.osp__k{flex:none;width:150px;font-weight:600;font-size:13px}
.osp__v{font-size:13px;color:#4d4d4d;min-width:0;word-break:break-word}
.osp__tag{display:inline-block;padding:1px 8px;border-radius:99px;font-size:11px;font-weight:700;margin-right:7px;white-space:nowrap}
.osp--wait{background:#EEE;color:#666}
.osp--ok{background:#E6F1EE;color:#0F6E5C}
.osp--no{background:#FAE9E6;color:#A33A2E}
.osp--warn{background:#FBF1DC;color:#9A6B00}
.osp__btns{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}
.osp__btns button{font:inherit;font-size:12.5px;font-weight:650;padding:6px 12px;border-radius:8px;border:1px solid #0F6E5C;background:#0F6E5C;color:#fff;cursor:pointer}
.osp__btns button.g{background:#fff;color:#0F6E5C}
.osp__track{height:250vh;position:relative;margin-top:18px}
.osp__pin{height:150px;display:flex;align-items:center;justify-content:center;border-radius:12px;border:2px dashed rgba(0,0,0,.25);background:#FCFAF4;font-weight:700;text-align:center;padding:12px}
.osp__pin.on{border-color:#0F6E5C;border-style:solid;background:#E6F1EE;color:#0F6E5C}
.osp__fade{margin-top:40vh;padding:18px;border-radius:12px;background:#F4F1E8;opacity:.15;transition:opacity .4s}
.osp__fade.on{opacity:1}
.osp__note{margin-top:8px;font-size:11.5px;color:#8a8a85}
`;

function ospLoadScript(src) {
  return new Promise((resolve, reject) => {
    const found = document.querySelector(`script[data-osp="${src}"]`);
    if (found) {
      if (found.dataset.ospDone === '1') { resolve(); return; }
      found.addEventListener('load', () => resolve());
      found.addEventListener('error', () => reject(new Error('load failed')));
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.dataset.osp = src;
    s.onload = () => { s.dataset.ospDone = '1'; resolve(); };
    s.onerror = () => reject(new Error('load failed: ' + src));
    document.head.appendChild(s);
  });
}

/** 이 요소를 실제로 스크롤시키는 조상 컨테이너를 찾는다. 없으면 null (= window 스크롤) */
function ospFindScroller(el) {
  try {
    let n = el.parentElement;
    while (n && n !== document.body && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 8) return n;
      n = n.parentElement;
    }
  } catch (e) { /* noop */ }
  return null;
}

class OrbitersScrollProbe extends HTMLElement {

  connectedCallback() {
    if (this._booted) return;
    this._booted = true;

    this.classList.add('osp');
    const rows = OSP_ROWS.map(([k, label]) =>
      `<div class="osp__row"><div class="osp__k">${label}</div>` +
      `<div class="osp__v" data-row="${k}"><span class="osp__tag osp--wait">대기</span><span class="osp__d">—</span></div></div>`
    ).join('');

    this.innerHTML = `
      <style>${OSP_CSS}</style>
      <div class="osp__panel">
        <p class="osp__title">Wix 스크롤 진단 — 게시된 사이트에서 확인하세요</p>
        ${rows}
        <div class="osp__btns">
          <button data-act="lenis-on">Lenis 켜기</button>
          <button class="g" data-act="lenis-off">Lenis 끄기</button>
          <button class="g" data-act="copy">결과 복사</button>
        </div>
        <p class="osp__note">아래로 천천히 스크롤하면 발화 · pin 결과가 채워집니다.</p>
      </div>
      <div class="osp__track">
        <div class="osp__pin" data-pin>pin 대상 — 스크롤 시 화면에 고정되어야 함</div>
        <div class="osp__fade" data-fade>ScrollTrigger 발화 확인용 블록</div>
      </div>`;

    this.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'lenis-on') this.lenisOn();
      if (act === 'lenis-off') this.lenisOff();
      if (act === 'copy') this.copyResult(btn);
    });

    this.checkFrame();
    this.checkScroller();
    this.loadGsap();
  }

  set(key, state, detail) {
    const box = this.querySelector(`[data-row="${key}"]`);
    if (!box) return;
    const label = { ok: '정상', no: '실패', warn: '주의', wait: '대기' }[state] || state;
    box.innerHTML = `<span class="osp__tag osp--${state}">${label}</span><span class="osp__d"></span>`;
    box.querySelector('.osp__d').textContent = detail || '';
  }

  /* --- 1. iframe 안인가 ------------------------------------------------- */
  checkFrame() {
    let inFrame = false;
    try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }
    if (inFrame) {
      this.set('frame', 'warn', 'iframe 안에서 실행 중 — 에디터 또는 미리보기입니다. 게시 후 실제 주소에서 다시 확인하세요.');
    } else {
      this.set('frame', 'ok', '페이지에 직접 삽입됨 (최상위 문서)');
    }
  }

  /* --- 2. 무엇이 스크롤되는가 ------------------------------------------- */
  checkScroller() {
    let sawWindowScroll = false;
    const onWin = () => { sawWindowScroll = true; };
    window.addEventListener('scroll', onWin, { passive: true });

    setTimeout(() => {
      const sc = ospFindScroller(this);
      if (sc) {
        const cls = String(sc.className || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
        const desc = sc.tagName.toLowerCase() + (sc.id ? '#' + sc.id : '') + (cls ? '.' + cls : '');
        this.set('scroller', 'warn',
          `별도 컨테이너가 스크롤합니다 → ${desc} · ScrollTrigger 에 scroller 옵션을 지정해야 하고, 이 선택자는 Wix 업데이트로 예고 없이 바뀔 수 있습니다.`);
      } else if (sawWindowScroll) {
        this.set('scroller', 'ok', 'window — 표준 스크롤입니다. ScrollTrigger 를 기본 설정으로 쓸 수 있습니다.');
      } else {
        this.set('scroller', 'wait', '아직 스크롤이 감지되지 않았습니다. 페이지를 조금 내려보세요.');
      }
    }, 2500);
  }

  /* --- 3. GSAP / ScrollTrigger ------------------------------------------ */
  async loadGsap() {
    const heightBefore = document.documentElement.scrollHeight;
    try {
      await ospLoadScript(OSP_CDN.gsap);
      if (!window.gsap) throw new Error('gsap 전역 없음');
      this.set('gsap', 'ok', 'v' + (window.gsap.version || '?') + ' 로드됨');
    } catch (err) {
      this.set('gsap', 'no', err.message + ' — Wix가 외부 스크립트를 막았을 수 있습니다.');
      this.set('st', 'no', 'GSAP 없이는 진행 불가');
      this.set('fire', 'no', 'GSAP 없이는 진행 불가');
      this.set('pin', 'no', 'GSAP 없이는 진행 불가');
      return;
    }
    try {
      await ospLoadScript(OSP_CDN.st);
      if (!window.ScrollTrigger) throw new Error('ScrollTrigger 전역 없음');
      this.set('st', 'ok', '플러그인 등록 준비됨');
    } catch (err) {
      this.set('st', 'no', err.message);
      return;
    }
    this.runScrollTests(heightBefore);
  }

  runScrollTests(heightBefore) {
    const { gsap, ScrollTrigger } = window;
    try { gsap.registerPlugin(ScrollTrigger); }
    catch (e) { this.set('st', 'no', 'registerPlugin 실패: ' + e.message); return; }

    const fade = this.querySelector('[data-fade]');
    const pin = this.querySelector('[data-pin]');
    const sc = ospFindScroller(this);
    const base = sc ? { scroller: sc } : {};

    /* 발화 — pin 없이 */
    try {
      ScrollTrigger.create({
        ...base,
        trigger: fade,
        start: 'top 85%',
        onEnter: () => {
          fade.classList.add('on');
          this.set('fire', 'ok', 'onEnter 콜백이 실행됐습니다' + (sc ? ' (scroller 지정 필요)' : ''));
        },
        onLeaveBack: () => fade.classList.remove('on')
      });
      this.set('fire', 'wait', '아래로 스크롤해서 확인하세요');
    } catch (e) {
      this.set('fire', 'no', e.message);
    }

    /* pin */
    try {
      ScrollTrigger.create({
        ...base,
        trigger: pin,
        start: 'top top+=80',
        end: '+=500',
        pin: true,
        pinSpacing: true,
        onToggle: (st) => {
          pin.classList.toggle('on', st.isActive);
          if (!st.isActive) return;
          const top = Math.round(pin.getBoundingClientRect().top);
          const stuck = Math.abs(top - 80) < 40;
          this.set('pin', stuck ? 'ok' : 'warn',
            stuck ? '고정 확인 — 화면에 붙은 채 유지됩니다'
                  : `핀은 걸렸지만 위치가 어긋납니다 (top=${top}px). Wix 레이아웃과 충돌 가능성.`);
        }
      });
      this.set('pin', 'wait', '아래로 스크롤해서 확인하세요');
    } catch (e) {
      this.set('pin', 'no', e.message);
    }

    /* pin 여백을 Wix가 받아주는지 */
    setTimeout(() => {
      try { ScrollTrigger.refresh(); } catch (e) { /* noop */ }
      const diff = document.documentElement.scrollHeight - heightBefore;
      if (diff > 100) {
        this.set('height', 'ok', `+${diff}px — pin 여백이 페이지 높이에 반영됐습니다`);
      } else {
        this.set('height', 'warn',
          `${diff >= 0 ? '+' : ''}${diff}px — Wix가 높이를 고정했을 수 있습니다. 이 경우 pin 구간이 잘립니다.`);
      }
    }, 1500);
  }

  /* --- 4. Lenis --------------------------------------------------------- */
  async lenisOn() {
    if (this._lenis) { this.set('lenis', 'warn', '이미 켜져 있습니다'); return; }
    this.set('lenis', 'wait', '불러오는 중…');
    try {
      await ospLoadScript(OSP_CDN.lenis);
      const L = window.Lenis || (window.lenis && window.lenis.default);
      if (!L) throw new Error('Lenis 전역 없음');
      const before = window.scrollY;
      this._lenis = new L({ duration: 1.1 });
      const raf = (t) => { if (this._lenis) { this._lenis.raf(t); requestAnimationFrame(raf); } };
      requestAnimationFrame(raf);
      if (window.ScrollTrigger) this._lenis.on('scroll', window.ScrollTrigger.update);
      setTimeout(() => {
        const jumped = Math.abs(window.scrollY - before) > 2;
        this.set('lenis', 'warn',
          '초기화됐습니다. 휠을 굴려 보세요 — 스크롤이 두 번 움직이거나 끊기면 Wix 스크롤과 충돌하는 것입니다.' +
          (jumped ? ' (초기화 직후 위치가 튀었습니다)' : ''));
      }, 400);
    } catch (err) {
      this.set('lenis', 'no', err.message);
    }
  }

  lenisOff() {
    if (!this._lenis) { this.set('lenis', 'wait', '켜져 있지 않습니다'); return; }
    try { this._lenis.destroy(); } catch (e) { /* noop */ }
    this._lenis = null;
    this.set('lenis', 'ok', '해제했습니다 — 기본 스크롤로 돌아왔습니다');
  }

  /* --- 5. 결과 복사 ------------------------------------------------------ */
  copyResult(btn) {
    const lines = ['[Wix 스크롤 진단]', 'UA: ' + navigator.userAgent, '주소: ' + location.href, ''];
    OSP_ROWS.forEach(([k, label]) => {
      const box = this.querySelector(`[data-row="${k}"]`);
      if (!box) return;
      const tag = box.querySelector('.osp__tag');
      const d = box.querySelector('.osp__d');
      lines.push(`- ${label}: [${tag ? tag.textContent : '?'}] ${d ? d.textContent : ''}`);
    });
    const text = lines.join('\n');
    const done = () => { const o = btn.textContent; btn.textContent = '복사됨'; setTimeout(() => { btn.textContent = o; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => { console.log(text); done(); });
    } else { console.log(text); done(); }
  }
}

if (!customElements.get('orbiters-scroll-probe')) {
  customElements.define('orbiters-scroll-probe', OrbitersScrollProbe);
}

/* ============================================================================
 * 판정 기준
 *
 * 실행 위치 = iframe          게시 전입니다. 나머지 결과는 무의미하니 게시 후 다시.
 * GSAP 로드 = 실패            여기서 끝. Wix가 외부 스크립트를 막은 것이고
 *                             pin · 타이핑 · 마키 전부 다른 방법을 찾아야 합니다.
 * 스크롤 주체 = window        최선. 시안 코드를 거의 그대로 쓸 수 있습니다.
 * 스크롤 주체 = 별도 컨테이너  동작은 하지만 Wix 내부 DOM 구조에 의존하게 됩니다.
 *                             Wix가 에디터를 업데이트하면 예고 없이 깨집니다.
 * pin = 정상 + 높이 = 정상    엔진 섹션 재현 가능성이 있습니다.
 * pin = 주의 또는 높이 = 주의  재현해도 레이아웃이 계속 틀어집니다. 정적 버전 권장.
 * Lenis                       켠 뒤 휠을 굴려 보고, 두 번 움직이거나 버벅이면
 *                             포기하는 게 맞습니다. 이건 눈으로만 판단됩니다.
 *
 * 모바일에서도 같은 절차로 한 번 더 확인하세요.
 * ========================================================================== */
