# CHANGELOG — sourcing-hub (소싱 카탈로그 검색)


## v1.01 — 2026-07-30

- 검색엔진 색인 차단(noindex 메타) 적용 — docs/index.html `<head>` 최상단에 `<meta name="robots" content="noindex, nofollow">` 삽입 (검색 노출 방지, GitHub Pages는 응답 헤더 수정 불가라 메타 태그 방식 사용)

