import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import '../../compare_report/src/index.css';
import '../../compare_report/src/styles/tokens.css';
import '../../compare_report/src/styles/responsive.css';

createRoot(document.getElementById('root')!).render(<App />);
