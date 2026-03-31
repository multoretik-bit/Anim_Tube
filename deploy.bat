@echo off
set "repo_url=https://github.com/multoretik-bit/Anim_Tube.git"

echo.
echo 🎬 AnimTube: Deployment to %repo_url%
echo --------------------------------------------------
echo.

:: 1. Проверка установки Git
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git не найден! Пожалуйста, скачайте его: https://git-scm.com/
    pause
    exit /b
)

:: 2. Инициализация (если еще не сделана)
if not exist .git (
    echo [*] Инициализация нового репозитория Git...
    git init
    echo.
)

:: 3. Настройка удаленного доступа (Remote)
echo [*] Настройка адреса GitHub...
git remote remove origin >nul 2>&1
git remote add origin %repo_url%
git branch -M main

:: 4. Подготовка файлов
echo [*] Индексация файлов...
git add .
set /p commit_msg="[?] Сообщение для коммита (Enter для пропуска): "
if "%commit_msg%"=="" set "commit_msg=Update AnimTube Studio"

echo [*] Коммит изменений...
git commit -m "%commit_msg%"

:: 5. Отправка в облако
echo.
echo [*] Отправка на GitHub (ветка main)...
echo [!] ВНИМАНИЕ: Если появится окно, введите свои данные от GitHub.
git push -u origin main --force

if %errorlevel% neq 0 (
    echo.
    echo [!!!] ОШИБКА: Не удалось отправить файлы.
    echo 1. Проверьте интернет.
    echo 2. Убедитесь, что репозиторий на GitHub существует.
    echo 3. Проверьте права доступа (нужно быть владельцем репозитория).
) else (
    echo.
    echo 🎉 УСПЕШНО! Ваши файлы теперь на GitHub.
    echo.
    echo 🌐 Не забудьте включить GitHub Pages в настройках (Settings -> Pages).
)

echo.
pause
