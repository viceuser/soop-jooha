# soop-jooha

시그 검색기입니다. 일반 사용자는 `/`에서 목록을 검색하고, 관리자는 `/staff-console`에서 관리자 비밀번호로 Firestore 목록을 수정합니다.

## 실행

```bash
npm install
npm run dev
```

## Firebase 설정

Vercel 환경변수 또는 `.env.local`에 아래 값을 등록합니다. 현재 코드는 기존 `soop-jooha` Firebase 값으로도 동작하도록 기본값을 포함하고 있습니다.

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

Firebase Console에서 해야 할 일:

1. Firestore Database 생성
2. Firestore 규칙에 `firestore.rules` 내용 붙여넣기
3. Vercel 환경변수 `VITE_ADMIN_PASSWORD`에 관리자 비밀번호 등록
4. `/staff-console`에서 관리자 비밀번호 입력
5. 기본 목록 업로드

## 배포

```bash
npm run build
npm run vercel:deploy -- --yes
```
