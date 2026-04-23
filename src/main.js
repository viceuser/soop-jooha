import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import fallbackTracks from '../list.json';
import './styles.css';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const isAdminPage = window.location.pathname.replace(/\/$/, '') === '/staff-console';

const state = {
  tracks: normalizeTracks(fallbackTracks),
  query: localStorage.getItem('sig:lastQuery') || '',
  isComposing: false,
  isAdmin: localStorage.getItem('sig:adminUnlocked') === 'true',
  status: '목록을 불러오는 중입니다.',
  editingId: null,
  unsubscribeTracks: null
};

function normalizeTracks(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const id = Number(item.id);
      const title = String(item.title || '').trim();
      const alias = Array.isArray(item.alias)
        ? item.alias.flatMap((value) => String(value).split(',')).map((value) => value.trim()).filter(Boolean)
        : [];
      if (!Number.isInteger(id) || id <= 0 || !title) return null;
      return { id, title, alias };
    })
    .filter(Boolean)
    .sort((a, b) => a.id - b.id || a.title.localeCompare(b.title, 'ko'));
}

function subscribeTracks() {
  state.unsubscribeTracks?.();

  const tracksQuery = query(collection(db, 'signatures'), orderBy('id', 'asc'));
  state.unsubscribeTracks = onSnapshot(
    tracksQuery,
    (snapshot) => {
      const remoteTracks = normalizeTracks(snapshot.docs.map((item) => item.data()));

      if (remoteTracks.length > 0) {
        state.tracks = remoteTracks;
        state.status = 'Firebase 목록과 연결되었습니다.';
      } else {
        state.tracks = normalizeTracks(fallbackTracks);
        state.status = isAdminPage
          ? 'Firebase 목록이 비어 있습니다. 기본 목록 업로드를 누르면 저장됩니다.'
          : '기본 목록을 표시 중입니다.';
      }

      render();
    },
    (error) => {
      state.tracks = normalizeTracks(fallbackTracks);
      state.status = `Firebase 연결 실패: ${error.code || error.message}`;
      render();
    }
  );
}

function getSearchResults() {
  const queryText = state.query.trim().toLowerCase();
  if (!queryText) return state.tracks;

  return state.tracks.filter((track) => (
    String(track.id).includes(queryText)
    || track.title.toLowerCase().includes(queryText)
    || track.alias.join(' ').toLowerCase().includes(queryText)
  ));
}

function render() {
  if (isAdminPage) {
    renderAdminPage();
  } else {
    renderPublicPage();
  }
}

function renderPublicPage() {
  const results = getSearchResults();

  document.getElementById('app').innerHTML = `
    <main class="shell public-shell">
      ${renderHeader('시그 검색기', false)}
      <section class="hero-panel">
        <div>
          <span class="eyebrow">SOOP JOOHA</span>
          <h2>번호와 제목을 빠르게 찾아보세요</h2>
        </div>
        <div class="hero-count">
          <strong id="heroCount">${results.length}</strong>
          <span>검색 결과</span>
        </div>
      </section>
      ${renderSearchPanel(results.length)}
      <div id="resultsMount">${renderTrackTable(results, false)}</div>
    </main>
  `;

  bindSearchEvents();
}

function renderAdminPage() {
  const results = getSearchResults();

  document.getElementById('app').innerHTML = `
    <main class="shell">
      ${renderHeader('목록 관리', true)}
      <section class="panel admin-panel">
        ${renderLoginBox()}
        ${renderEditor()}
      </section>
      ${renderSearchPanel(results.length)}
      <div id="resultsMount">${renderTrackTable(results, true)}</div>
    </main>
  `;

  bindSearchEvents();
  bindAdminEvents();
}

function renderHeader(title, showHome) {
  return `
    <header class="topbar">
      <div class="brand">
        <img src="/logo.png" alt="로고" />
        <h1>${escapeHtml(title)}</h1>
      </div>
      ${showHome ? '<a class="link-button" href="/">검색 페이지</a>' : ''}
    </header>
  `;
}

function renderSearchPanel(resultCount) {
  return `
    <section class="panel search-panel">
      <label class="search-label" for="searchInput">검색어</label>
      <input
        id="searchInput"
        class="search-input"
        type="search"
        value="${escapeAttr(state.query)}"
        placeholder="번호, 제목, 별칭으로 검색"
        autocomplete="off"
      />
      <div class="info-bar">
        <span id="statusText">${escapeHtml(state.status)}</span>
        <span id="resultCountText">총 ${resultCount}개</span>
      </div>
    </section>
  `;
}

function renderLoginBox() {
  if (state.isAdmin) {
    return `
      <div class="auth-box">
        <div>
          <strong>관리자 모드가 열려 있습니다.</strong>
          <p>이 브라우저에서는 로그인 상태가 유지됩니다.</p>
        </div>
        <button class="btn subtle" id="logoutButton" type="button">관리자 잠금</button>
      </div>
    `;
  }

  return `
    <form class="auth-box login-form" id="loginForm">
      <div>
        <strong>관리자 로그인</strong>
        <p>관리자 비밀번호로 수정 권한을 엽니다.</p>
        <p class="debug-line">Firebase: ${escapeHtml(firebaseConfig.projectId)} / ${escapeHtml(firebaseConfig.authDomain)}</p>
      </div>
      <label>
        비밀번호
        <input id="adminPassword" type="password" autocomplete="current-password" required />
      </label>
      <button class="btn" type="submit">로그인</button>
    </form>
  `;
}

function renderEditor() {
  const disabled = !state.isAdmin;
  const editingTrack = state.tracks.find((track) => track.id === state.editingId);

  return `
    <form class="entry-form" id="entryForm">
      <label>
        번호
        <input id="entryId" type="number" min="1" inputmode="numeric" value="${editingTrack ? editingTrack.id : ''}" ${disabled ? 'disabled' : ''} />
      </label>
      <label>
        제목
        <input id="entryTitle" type="text" value="${editingTrack ? escapeAttr(editingTrack.title) : ''}" ${disabled ? 'disabled' : ''} />
      </label>
      <label>
        별칭 검색어
        <input id="entryAlias" type="text" value="${editingTrack ? escapeAttr(editingTrack.alias.join(', ')) : ''}" ${disabled ? 'disabled' : ''} />
      </label>
      <div class="form-actions">
        <button class="btn" type="submit" ${disabled ? 'disabled' : ''}>${editingTrack ? '수정 저장' : '추가 저장'}</button>
        <button class="btn subtle" id="cancelEditButton" type="button" ${disabled || !editingTrack ? 'disabled' : ''}>취소</button>
        <button class="btn subtle" id="seedButton" type="button" ${disabled ? 'disabled' : ''}>기본 목록 업로드</button>
      </div>
    </form>
  `;
}

function renderTrackTable(tracks, editable) {
  const rows = tracks.map((track) => `
    <tr>
      <td class="id-cell">${track.id}</td>
      <td>${escapeHtml(track.title)}</td>
      ${editable ? `
        <td class="actions-cell">
          <button class="mini-button" data-edit-id="${track.id}" type="button" ${!state.isAdmin ? 'disabled' : ''}>수정</button>
          <button class="mini-button danger" data-delete-id="${track.id}" type="button" ${!state.isAdmin ? 'disabled' : ''}>삭제</button>
        </td>
      ` : ''}
    </tr>
  `).join('');

  return `
    <section class="table-wrap search-results" aria-label="검색 결과">
      <table>
        <thead>
          <tr>
            <th class="id-cell">번호</th>
            <th>제목</th>
            ${editable ? '<th class="actions-cell">관리</th>' : ''}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="empty" ${rows ? 'hidden' : ''}>검색된 항목이 없습니다.</div>
    </section>
  `;
}

function updateSearchResultsOnly() {
  const results = getSearchResults();
  const resultsMount = document.getElementById('resultsMount');
  const statusText = document.getElementById('statusText');
  const resultCountText = document.getElementById('resultCountText');
  const heroCount = document.getElementById('heroCount');

  if (resultsMount) {
    resultsMount.innerHTML = renderTrackTable(results, isAdminPage);
  }

  if (statusText) {
    statusText.textContent = state.status;
  }

  if (resultCountText) {
    resultCountText.textContent = `총 ${results.length}개`;
  }

  if (heroCount) {
    heroCount.textContent = String(results.length);
  }

  bindResultActionEvents();
}

function bindSearchEvents() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;

  if (searchInput.dataset.bound === 'true') return;
  searchInput.dataset.bound = 'true';

  if (window.matchMedia('(pointer: fine)').matches && !isAdminPage) {
    searchInput.focus();
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
  }

  searchInput.addEventListener('input', (event) => {
    if (state.isComposing || event.isComposing) return;
    state.query = event.target.value;
    localStorage.setItem('sig:lastQuery', state.query);
    updateSearchResultsOnly();
  });

  searchInput.addEventListener('compositionstart', () => {
    state.isComposing = true;
  });

  searchInput.addEventListener('compositionend', (event) => {
    state.isComposing = false;
    state.query = event.target.value;
    localStorage.setItem('sig:lastQuery', state.query);
    updateSearchResultsOnly();
  });
}

function bindAdminEvents() {
  document.getElementById('loginForm')?.addEventListener('submit', unlockAdmin);
  document.getElementById('logoutButton')?.addEventListener('click', lockAdmin);
  document.getElementById('seedButton')?.addEventListener('click', seedDefaultTracks);
  document.getElementById('cancelEditButton')?.addEventListener('click', () => {
    state.editingId = null;
    render();
  });
  document.getElementById('entryForm')?.addEventListener('submit', saveTrack);
  bindResultActionEvents();
}

function bindResultActionEvents() {
  document.querySelectorAll('[data-edit-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.editingId = Number(button.dataset.editId);
      render();
    });
  });

  document.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', () => deleteTrack(Number(button.dataset.deleteId)));
  });
}

function unlockAdmin(event) {
  event.preventDefault();

  const password = String(document.getElementById('adminPassword')?.value || '');
  if (!ADMIN_PASSWORD) {
    state.status = '관리자 비밀번호 환경변수 VITE_ADMIN_PASSWORD가 설정되지 않았습니다.';
    render();
    return;
  }

  if (password !== ADMIN_PASSWORD) {
    state.status = '관리자 비밀번호가 맞지 않습니다.';
    render();
    return;
  }

  state.isAdmin = true;
  localStorage.setItem('sig:adminUnlocked', 'true');
  state.status = '관리자 모드가 열렸습니다.';
  render();
}

function lockAdmin() {
  state.isAdmin = false;
  state.editingId = null;
  localStorage.removeItem('sig:adminUnlocked');
  state.status = '관리자 모드를 잠갔습니다.';
  render();
}

async function saveTrack(event) {
  event.preventDefault();
  if (!state.isAdmin) return;

  const id = Number(document.getElementById('entryId')?.value);
  const title = String(document.getElementById('entryTitle')?.value || '').trim();
  const alias = String(document.getElementById('entryAlias')?.value || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!Number.isInteger(id) || id <= 0 || !title) {
    state.status = '번호와 제목을 올바르게 입력해 주세요.';
    render();
    return;
  }

  try {
    await setDoc(doc(db, 'signatures', String(id)), {
      id,
      title,
      alias,
      updatedAt: serverTimestamp()
    }, { merge: true });

    state.editingId = null;
    state.status = `${id}번을 저장했습니다.`;
    render();
  } catch (error) {
    state.status = `저장 실패: ${error.code || error.message}`;
    render();
  }
}

async function deleteTrack(id) {
  if (!state.isAdmin) return;
  if (!window.confirm(`${id}번 항목을 삭제할까요?`)) return;

  try {
    await deleteDoc(doc(db, 'signatures', String(id)));
    state.status = `${id}번을 삭제했습니다.`;
    render();
  } catch (error) {
    state.status = `삭제 실패: ${error.code || error.message}`;
    render();
  }
}

async function seedDefaultTracks() {
  if (!state.isAdmin) return;
  if (!window.confirm('현재 기본 목록을 Firebase에 업로드할까요? 같은 번호는 덮어씁니다.')) return;

  try {
    const tracks = normalizeTracks(fallbackTracks);
    await Promise.all(tracks.map((track) => setDoc(doc(db, 'signatures', String(track.id)), {
      id: track.id,
      title: track.title,
      alias: track.alias || [],
      updatedAt: serverTimestamp()
    }, { merge: true })));

    state.status = `기본 목록 ${tracks.length}개를 업로드했습니다.`;
    render();
  } catch (error) {
    state.status = `기본 목록 업로드 실패: ${error.code || error.message}`;
    render();
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

subscribeTracks();
render();
