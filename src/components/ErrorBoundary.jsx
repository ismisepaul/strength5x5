import React from 'react';
import i18n from '../i18n/index.js';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const t = i18n.t.bind(i18n);
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-8">
          <div className="text-center max-w-sm">
            <h1 className="text-2xl font-black uppercase mb-4">{t('error.title')}</h1>
            <p className="text-slate-400 text-sm mb-6">{t('error.body')}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-6 py-3 bg-indigo-600 rounded-xl font-black uppercase text-sm"
            >
              {t('error.tryAgain')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
