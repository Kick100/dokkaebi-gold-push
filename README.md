# 도깨비의 세계 금전 수급 알리미

Android Chrome용 설치형 PWA + 서버 발송 Web Push. 브라우저를 닫아도 알림을 받도록 설계했습니다.

## 실행
1. Node.js 20 이상 설치.
2. `npm install`
3. `npx web-push generate-vapid-keys` 로 키 발급.
4. `.env.example`을 참고해 호스팅 환경 변수 `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` 설정. (Node는 `.env`를 자동으로 읽지 않으므로 호스팅 환경 변수로 입력하거나 `node --env-file=.env server.js`로 실행)
5. `npm start` 실행.
6. HTTPS로 배포한 뒤 Android Chrome에서 접속 → 메뉴 → 홈 화면에 추가/앱 설치 → 푸시 알림 켜기 → 테스트 알림.

## 배포 권장
이 구성은 **Render 무료 Web Service** 전용입니다. 무료 서버는 유휴 상태에서 슬립하며 정시 알림을 보장하지 않습니다. 또한 영구 디스크가 없으므로 재시작/배포 시 저장된 푸시 구독 및 설정이 사라질 수 있으며, 휴대폰에서 재구독해야 할 수 있습니다. HTTPS가 필수입니다. `DATA_FILE`은 임시 경로입니다. 서버를 여러 인스턴스로 실행하면 JSON 저장소와 스케줄러가 중복 실행될 수 있으므로 단일 인스턴스로 운영하세요.

## 일정 및 주의
앱에 등록된 시간은 기존 대화의 공략 정리를 바탕으로 한 **수정 가능한 초기값**입니다. 공식 서버 공지나 게임 내 일정과 다를 수 있습니다. 요일은 일=0~토=6, 시간대는 Asia/Seoul입니다. 알림 10분 전 설정은 실제 시작 시각보다 10분 전에 발송됩니다.

낙화의 전장 시즌 알림과 거래소 점검은 기본 OFF. 문파 14시 편성이라면 20시 기본값을 변경하세요.

## 보안/운영
이 프로젝트는 개인용 최소 구현입니다. 구독 엔드포인트에 사용자 인증, 요청 제한, 관리 화면이 없으므로 공개 다중 사용자 서비스로 운영하려면 인증·DB·rate limiting·모니터링을 추가해야 합니다. `/api/test`는 누구나 deviceId를 알고 있다면 호출할 수 있으므로 공개 운영에서는 인증이 필요합니다. 푸시 수신은 OS 배터리 최적화, 브라우저 알림 설정, 네트워크 상태에 따라 지연될 수 있습니다.

## Render Blueprint 배포
`render.yaml`은 싱가포르 리전의 무료 Free 서비스를 선언하며 유료 디스크를 사용하지 않습니다. 무료 플랜 제공 여부와 제한은 Render 화면에서 확인하세요. GitHub에 파일을 올린 후 Render Blueprint를 연결하거나 동일 설정으로 Web Service를 생성합니다. VAPID 키 2개와 VAPID_SUBJECT(예: mailto:your-email@example.com)는 Render 환경 변수로 별도 입력하세요. `/health`로 헬스체크합니다.
