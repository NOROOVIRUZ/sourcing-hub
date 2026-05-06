@echo off
title 카탈로그 동기화 중...
cd /d "%~dp0tools\catalog-search"
echo.
echo  ==========================================
echo   카탈로그 파싱 + GitHub 업로드 시작
echo  ==========================================
echo.
call npm run sync
echo.
if %ERRORLEVEL% EQU 0 (
  echo  ==========================================
  echo   완료! 팀원들이 바로 검색할 수 있어.
  echo  ==========================================
) else (
  echo  오류가 발생했어. 위 메시지 확인해줘.
)
echo.
pause
