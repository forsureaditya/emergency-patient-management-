import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// React owns the UI; domain classes own scheduling and patient records.
createRoot(document.getElementById('root')).render(<App />);
