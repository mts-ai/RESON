/**
 * Audio Path Helper
 * Обработка путей к аудио файлам для разных окружений
 */

/**
 * Определяет, запущен ли отчет в Jupyter Lab/Notebook
 */
export function isJupyterEnvironment(): boolean {
  // Проверяем наличие специфичных для Jupyter признаков
  if (typeof window === 'undefined') return false;
  
  // Jupyter обычно работает на localhost с портами 8888-8899
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';
  
  // Проверяем наличие Jupyter-специфичных элементов в URL или DOM
  const hasJupyterInPath = window.location.pathname.includes('/notebooks/') ||
                           window.location.pathname.includes('/lab/') ||
                           document.querySelector('[data-jupyter-kernel]') !== null;
  
  return isLocalhost && hasJupyterInPath;
}

/**
 * Преобразует путь к аудио файлу для корректной загрузки
 * @param audioPath - Исходный путь к аудио файлу
 * @param audioBasePath - Базовый путь из настроек (опционально)
 * @returns Корректный URL для загрузки аудио
 */
export function resolveAudioPath(audioPath: string, audioBasePath?: string): string {
  if (!audioPath) return '';
  
  // Если это уже URL (http:// или https://), возвращаем как есть
  if (audioPath.startsWith('http://') || audioPath.startsWith('https://')) {
    return audioPath;
  }
  
  // Для Jupyter Lab используем специальный endpoint
  if (isJupyterEnvironment()) {
    // Удаляем ведущий слэш если есть
    const cleanPath = audioPath.startsWith('/') ? audioPath.substring(1) : audioPath;
    
    // Jupyter предоставляет файлы через /files/ endpoint
    // Если есть базовый путь, комбинируем его
    if (audioBasePath) {
      return `/files/${audioBasePath}/${cleanPath}`;
    }
    
    return `/files/${cleanPath}`;
  }
  
  // Для обычного браузера просто возвращаем относительный путь
  // (он уже должен быть преобразован в generate_report.py)
  return audioPath;
}

/**
 * Проверяет доступность аудио файла
 * @param audioUrl - URL аудио файла
 * @returns Promise<boolean> - true если файл доступен
 */
export async function checkAudioAvailability(audioUrl: string): Promise<boolean> {
  if (!audioUrl) return false;
  
  try {
    const response = await fetch(audioUrl, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.warn(`Audio file not available: ${audioUrl}`, error);
    return false;
  }
}

/**
 * Получает информацию об окружении для отладки
 */
export function getEnvironmentInfo() {
  return {
    isJupyter: isJupyterEnvironment(),
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    port: window.location.port,
    protocol: window.location.protocol
  };
}
