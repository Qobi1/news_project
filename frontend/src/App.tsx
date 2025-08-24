import React, { useState, useEffect } from 'react';
import './index.css';

interface NewsArticle {
  id: number;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  category: string;
  date: string;
  author: string;
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'home' | 'article'>('home');
  const [currentArticle, setCurrentArticle] = useState<NewsArticle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Все');
  const [filteredArticles, setFilteredArticles] = useState<NewsArticle[]>([]);
  const [displayedArticles, setDisplayedArticles] = useState<NewsArticle[]>([]);
  const [articlesToShow, setArticlesToShow] = useState(8);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [newsData, setNewsData] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backendUrl = 'http://localhost:8000';

  function mapApiNewsToArticle(apiNews: any): NewsArticle {
    return {
      id: apiNews.id,
      title: apiNews.title,
      excerpt: apiNews.description,
      content: apiNews.description,
      image: apiNews.image_url,
      category: apiNews.category,
      date: apiNews.datetime_str,
      author: apiNews.location // fallback, since API doesn't provide author
    };
  }

  useEffect(() => {
    fetch(`${backendUrl}/news/`)
      .then(res => res.json())
      .then(data => {
        setNewsData(data.map(mapApiNewsToArticle));
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    // Check for article ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('id');

    if (articleId) {
      setLoading(true);
      fetch(`${backendUrl}/news/${encodeURIComponent(articleId)}`)
        .then(res => {
          if (!res.ok) throw new Error('Статья не найдена');
          return res.json();
        })
        .then(apiNews => {
          // Fix: ensure date is ISO string for correct parsing
          const fixedApiNews = {
            ...apiNews,
            datetime_str: apiNews.datetime_iso || apiNews.datetime_str
          };
          setCurrentArticle(mapApiNewsToArticle(fixedApiNews));
          setCurrentView('article');
          setLoading(false);
        })
        .catch((e) => {
          setError(e.message || 'Ошибка загрузки статьи');
          setCurrentArticle(null);
          setCurrentView('home');
          setLoading(false);
        });
    }
  }, []);

  const handleReadMore = (article: NewsArticle) => {
    // Always fetch fresh data from backend for details page
    setLoading(true);
    window.history.pushState({}, '', `?id=${article.id}`);
    fetch(`${backendUrl}/news/${article.id}`)
      .then(res => {
        if (!res.ok) throw new Error('Статья не найдена');
        return res.json();
      })
      .then(apiNews => {
        const fixedApiNews = {
          ...apiNews,
          datetime_str: apiNews.datetime_iso || apiNews.datetime_str
        };
        setCurrentArticle(mapApiNewsToArticle(fixedApiNews));
        setCurrentView('article');
        setLoading(false);
        window.scrollTo(0, 0);
      })
      .catch((e) => {
        setError(e.message || 'Ошибка загрузки статьи');
        setCurrentArticle(null);
        setCurrentView('home');
        setLoading(false);
      });
  };

  const handleBackToHome = () => {
    // Clear URL parameters
    window.history.pushState({}, '', window.location.pathname);
    setCurrentView('home');
    setCurrentArticle(null);
    window.scrollTo(0, 0);
  };

  const handleLoadMore = () => {
    setArticlesToShow(prev => prev + 3);
  };

  const handleSmoothScroll = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission (in real app, would send to backend)
    alert('Спасибо за ваше сообщение! Мы свяжемся с вами в ближайшее время.');
    setContactForm({ name: '', email: '', message: '' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  function getShortDescription(text: string, wordCount: number = 20) {
    const words = text.split(' ');
    return words.length > wordCount ? words.slice(0, wordCount).join(' ') + '...' : text;
  }

  // Helper function to wrap consecutive images in a scrollable div
  function wrapImagesScrollable(html: string) {
    // Match consecutive <img ... /> tags at the end of the content
    const imgGroupRegex = /((<img[^>]+>\s*){2,})$/;
    return html.replace(imgGroupRegex, (match) => {
      return `<div style="display: flex; overflow-x: auto; gap: 16px; padding: 12px 0; border-radius: 12px; background: #f8f9fa;">${match}</div>`;
    });
  }

  // Helper for safe date formatting
  function formatDateSafe(dateString: string) {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  if (loading) return <div>Loading...</div>;
  if (error && currentView === 'article') {
    return (
      <div className="container py-5 text-center">
        <h2 className="mb-4 text-danger">{error}</h2>
        <button className="btn btn-primary" onClick={handleBackToHome}>
          Назад на главную
        </button>
      </div>
    );
  }

  if (currentView === 'article' && currentArticle) {
    return (
      <>
        {/* Navigation for Article Page */}
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark sticky-top shadow">
          <div className="container">
            <a className="navbar-brand fw-bold fs-3" href="#" onClick={handleBackToHome}>
              <i className="bi bi-newspaper me-2"></i>Новости
            </a>
          </div>
        </nav>
        {/* Breadcrumbs for Article Detail Page */}
        <div className="container mt-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb bg-white px-3 py-2 rounded shadow-sm">
              <li className="breadcrumb-item">
                <a href="#" onClick={handleBackToHome} style={{ textDecoration: 'none', color: '#007bff' }}>Главная</a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">{currentArticle.title}</li>
            </ol>
          </nav>
        </div>

        {/* Article Detail View */}
        <main className="py-4">
          <div className="container">
            <button 
              className="btn btn-outline-primary mb-4"
              onClick={handleBackToHome}
            >
              <i className="bi bi-arrow-left me-2"></i>Назад на главную
            </button>
            <article className="bg-white rounded shadow-sm overflow-hidden">
              <div className="p-4 p-lg-5">
                <header className="mb-4">
                  <span className="badge bg-primary mb-3 fs-6">{currentArticle.category}</span>
                  <h1 className="display-5 fw-bold mb-3">{currentArticle.title}</h1>
                  <div className="d-flex flex-wrap align-items-center text-muted mb-3">
                    <div className="me-4 mb-2">
                      <i className="bi bi-calendar me-2"></i>
                      {formatDate(currentArticle.date)}
                    </div>
                    <div className="me-4 mb-2">
                      <i className="bi bi-person me-2"></i>
                      {currentArticle.author}
                    </div>
                    <div className="mb-2">
                      <i className="bi bi-clock me-2"></i>
                      5 мин чтения
                    </div>
                  </div>
                </header>
                
                <div className="article-content">
                  <div
                    dangerouslySetInnerHTML={{ __html: wrapImagesScrollable(currentArticle.content) }}
                  />
                </div>
                
                <footer className="border-top pt-4 mt-5">
                  <div className="row">
                    <div className="col-md-6 text-md-end">
                      <p className="text-muted mb-0">
                        <small>© 2024 Новости. Все права защищены.</small>
                      </p>
                    </div>
                  </div>
                </footer>
              </div>
            </article>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-5">
          <div className="container">
            <div className="row">
              <div className="col-lg-4 mb-4">
                <h5 className="fw-bold mb-3" style={{color: '#ffeb3b'}}>
                  <i className="bi bi-newspaper me-2"></i>Новости
                </h5>
                <p className="text-muted" style={{color: '#fff'}}>
                  Ваш надежный источник достоверных новостей и подробного анализа.
                </p>
                <div className="social-links">
                  <a href="#" className="me-3 fs-4" style={{color: '#ffeb3b'}}>
                    <i className="bi bi-facebook"></i>
                  </a>
                  <a href="#" className="me-3 fs-4" style={{color: '#ffeb3b'}}>
                    <i className="bi bi-twitter"></i>
                  </a>
                  <a href="#" className="me-3 fs-4" style={{color: '#ffeb3b'}}>
                    <i className="bi bi-instagram"></i>
                  </a>
                  <a href="#" className="me-3 fs-4" style={{color: '#ffeb3b'}}>
                    <i className="bi bi-linkedin"></i>
                  </a>
                  <a href="#" className="fs-4" style={{color: '#ffeb3b'}}>
                    <i className="bi bi-youtube"></i>
                  </a>
                </div>
              </div>
              <div className="col-lg-2 col-md-6 mb-4">
                <h6 className="fw-bold mb-3" style={{color: '#ffeb3b'}}>Быстрые ссылки</h6>
                <ul className="list-unstyled">
                  <li><a href="#home" className="text-muted text-decoration-none" style={{color: '#fff'}} onClick={() => handleSmoothScroll('home')}>Главная</a></li>
                  <li><a href="#news" className="text-muted text-decoration-none" style={{color: '#fff'}} onClick={() => handleSmoothScroll('news')}>Новости</a></li>
                  <li><a href="#contact" className="text-muted text-decoration-none" style={{color: '#fff'}} onClick={() => handleSmoothScroll('about')}>О нас</a></li>
                </ul>
              </div>
              <div className="col-lg-4 mb-4">
                <h6 className="fw-bold mb-3" style={{color: '#ffeb3b'}}>Подписка на новости</h6>
                <p className="mb-3" style={{color: '#fff'}}>Подпишитесь, чтобы получать последние новости на вашу почту.</p>
              </div>
            </div>
            <hr className="my-4" />
            <div className="row align-items-center">
              <div className="col-md-6">
                <p className="text-muted mb-0" style={{color: '#fff'}}>
                  © 2025 Новости. Все права защищены.
                </p>
              </div>
              <div className="col-md-6 text-md-end">
                <a href="#" className="text-muted text-decoration-none me-3" style={{color: '#fff'}}>Политика конфиденциальности</a>
                <a href="#" className="text-muted text-decoration-none me-3" style={{color: '#fff'}}>Условия использования</a>
                <a href="#" className="text-muted text-decoration-none" style={{color: '#fff'}}>Политика файлов cookie</a>
              </div>
            </div>
          </div>
        </footer>
      </>
    );
  }

  return (
    <>
      {/* Navigation */}
      <nav className="navbar navbar-expand-lg sticky-top shadow">
        <div className="container d-flex align-items-center justify-content-between">
          <a className="navbar-brand fw-bold" href="#home">
            <i className="bi bi-newspaper me-2"></i>Новости
          </a>
          <div className="d-flex gap-2">
            <button className="nav-link btn btn-gradient" onClick={() => handleSmoothScroll('home')}>Главная</button>
            <button className="nav-link btn btn-gradient" onClick={() => handleSmoothScroll('news')}>Новости</button>
            <button className="nav-link btn btn-gradient" onClick={() => handleSmoothScroll('about')}>О нас</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="hero-section bg-gradient text-white py-5">
        <div className="container">
          <div className="row align-items-center min-vh-75">
            <div className="col-lg-8">
              <h1 className="display-3 fw-bold mb-4 fade-in">Добро пожаловать в Новости</h1>
              <p className="lead mb-4 fade-in">
                Ваш надежный источник последних новостей в области технологий, науки, бизнеса, спорта и многого другого.
                Будьте в курсе событий с обновления в реальном времени и подробным анализом от наших экспертов.
              </p>
              <button 
                className="btn btn-light btn-lg fade-in shadow-lg px-4 py-2 rounded-pill"
                onClick={() => handleSmoothScroll('news')}
              >
                Смотреть последние новости <i className="bi bi-arrow-down ms-2"></i>
              </button>
            </div>
            <div className="col-lg-4 text-center">
              <img 
                src="https://images.pexels.com/photos/518543/pexels-photo-518543.jpeg" 
                alt="Новости и медиа"
                className="img-fluid rounded shadow-lg fade-in"
                style={{maxHeight: '340px', objectFit: 'cover'}}
              />
            </div>
          </div>
        </div>
      </section>

      {/* News Section */}
      <section id="news" className="py-5 bg-light">
        <div className="container">
          <div className="row mb-5">
            <div className="col-12 text-center">
              <h2 className="display-4 fw-bold mb-3">Последние новости</h2>
              <p className="lead text-muted">Будьте в курсе самых свежих событий</p>
            </div>
          </div>
          <div className="row mb-4">
            <div className="col-lg-6 mx-auto">
              <div className="input-group shadow rounded-pill overflow-hidden">
                <span className="input-group-text bg-white border-0">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-0"
                  placeholder="Поиск новостных статей..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{background: 'transparent'}}
                />
              </div>
            </div>
          </div>
          <div className="row">
            {newsData.slice(0, articlesToShow).map((article, index) => (
              <div key={article.id} className="col-lg-3 col-md-6 mb-4">
                <article className="card h-100 shadow-lg border-0 hover-card fade-in-article" style={{animationDelay: `${index * 0.1}s`}}>
                  <img 
                    src={article.image} 
                    alt={article.title}
                    className="card-img-top news-image rounded-top"
                  />
                  <div className="card-body d-flex flex-column">
                    <div className="mb-2">
                      <span className="badge bg-gradient mb-2 px-3 py-2 rounded-pill text-white" style={{fontSize: '0.9rem'}}>{article.category}</span>
                    </div>
                    <h5 className="card-title fw-bold mb-2">{article.title}</h5>
                    <div className="card-text text-muted flex-grow-1 mb-2" style={{overflow: 'hidden', textOverflow: 'ellipsis'}}>
                      <span dangerouslySetInnerHTML={{ __html: getShortDescription(article.excerpt, 20) }} />
                    </div>
                    <div className="mt-auto">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <small className="text-muted">
                          <i className="bi bi-calendar me-1"></i>
                          {formatDateSafe(article.date)}
                        </small>
                        <small className="text-muted">
                          <i className="bi bi-person me-1"></i>
                          {article.author}
                        </small>
                      </div>
                      <button 
                        className="btn btn-primary w-100 rounded-pill fw-bold"
                        onClick={() => handleReadMore(article)}
                      >
                        Читать далее <i className="bi bi-arrow-right ms-1"></i>
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            ))}
            {newsData.length === 0 && (
              <div className="col-12 text-center py-5">
                <i className="bi bi-search display-1 text-muted"></i>
                <h3 className="mt-3 text-muted">Статьи не найдены</h3>
                <p className="text-muted">Попробуйте изменить критерии поиска.</p>
              </div>
            )}
          </div>
          {articlesToShow < newsData.length && (
            <div className="row">
              <div className="col-12 text-center">
                <button 
                  className="btn btn-outline-primary btn-lg rounded-pill px-5"
                  onClick={() => setArticlesToShow(prev => prev + 4)}
                >
                  Загрузить еще статьи <i className="bi bi-plus-circle ms-2"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-5 bg-gradient text-white">
        <div className="container">
          <div className="row mb-5">
            <div className="col-12 text-center">
              <h2 className="display-4 fw-bold mb-3">О нас</h2>
              <p className="lead">Новости — ваш надежный источник свежих новостей, аналитики и событий Иркутска и региона. Мы стремимся предоставлять только проверенную информацию, помогать быть в курсе важных событий и поддерживать связь с нашей аудиторией.</p>
            </div>
          </div>
          <div className="row">
            <div className="col-lg-8 mx-auto">
              <div className="card shadow-lg border-0 bg-white text-dark">
                <div className="card-body p-5">
                  <h4 className="fw-bold mb-3">Наша миссия</h4>
                  <p>Мы работаем для того, чтобы вы всегда были информированы о главных событиях города и области. Наша команда журналистов и редакторов ежедневно следит за новостями, чтобы вы получали только актуальную и достоверную информацию.</p>
                  <h4 className="fw-bold mb-3 mt-4">Наши ценности</h4>
                  <ul className="mb-4">
                    <li>Объективность и честность</li>
                    <li>Оперативность и актуальность</li>
                    <li>Открытость для обратной связи</li>
                    <li>Поддержка местного сообщества</li>
                  </ul>
                  <p className="mb-0">Спасибо, что выбираете нас!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-5 bg-gradient text-white">
        <div className="container">
          <div className="row">
            <div className="col-lg-4 mb-4">
              <h5 className="fw-bold mb-3" style={{color: '#ffeb3b'}}>
                <i className="bi bi-newspaper me-2"></i>Новости
              </h5>
              <p className="mb-3">
                Ваш надежный источник достоверных новостей и подробного анализа.
              </p>
              <div className="social-links">
                <a href="#" className="me-3 fs-4" style={{color: '#ffeb3b'}}>
                  <i className="bi bi-facebook"></i>
                </a>
                <a href="#" className="me-3 fs-4" style={{color: '#ffeb3b'}}>
                  <i className="bi bi-twitter"></i>
                </a>
                <a href="#" className="me-3 fs-4" style={{color: '#ffeb3b'}}>
                  <i className="bi bi-instagram"></i>
                </a>
                <a href="#" className="me-3 fs-4" style={{color: '#ffeb3b'}}>
                  <i className="bi bi-linkedin"></i>
                </a>
                <a href="#" className="fs-4" style={{color: '#ffeb3b'}}>
                  <i className="bi bi-youtube"></i>
                </a>
              </div>
            </div>
            <div className="col-lg-2 col-md-6 mb-4">
              <h6 className="fw-bold mb-3" style={{color: '#ffeb3b'}}>Быстрые ссылки</h6>
              <ul className="list-unstyled">
                <li><a href="#home" className="text-white text-decoration-none" onClick={() => handleSmoothScroll('home')}>Главная</a></li>
                <li><a href="#news" className="text-white text-decoration-none" onClick={() => handleSmoothScroll('news')}>Новости</a></li>
                <li><a href="#contact" className="text-white text-decoration-none" onClick={() => handleSmoothScroll('about')}>О нас</a></li>
              </ul>
            </div>
            <div className="col-lg-4 mb-4">
              <h6 className="fw-bold mb-3" style={{color: '#ffeb3b'}}>Подписка на новости</h6>
              <p className="mb-3" style={{color: '#fff'}}>Подпишитесь, чтобы получать последние новости на вашу почту.</p>
            </div>
          </div>
          <hr className="my-4" />
          <div className="row align-items-center">
            <div className="col-md-6">
              <p className="mb-0" style={{color: '#fff'}}>
                © 2025 Новости. Все права защищены.
              </p>
            </div>
            <div className="col-md-6 text-md-end">
              <a href="#" className="text-white text-decoration-none me-3">Политика конфиденциальности</a>
              <a href="#" className="text-white text-decoration-none me-3">Условия использования</a>
              <a href="#" className="text-white text-decoration-none">Политика файлов cookie</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default App;