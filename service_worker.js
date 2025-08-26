// Service Worker para PWA - Controle Financeiro PJ
// Version 1.0.0

const CACHE_NAME = 'financeiro-pj-v1.0.0';
const API_CACHE = 'financeiro-pj-api-v1';

// Arquivos essenciais para cache
const STATIC_FILES = [
  '/',
  '/manifest.json',
  // Não incluir scripts externos pois podem mudar
];

// Rotas da API para cache
const API_ROUTES = [
  '/api/categorias',
  '/api/dashboard'
];

// ===== INSTALAÇÃO =====
self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker v1.0.0');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Criando cache inicial');
        return cache.addAll(STATIC_FILES.filter(url => url !== '/'));
      })
      .then(() => {
        console.log('[SW] Cache inicial criado');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Erro ao criar cache inicial:', error);
      })
  );
});

// ===== ATIVAÇÃO =====
self.addEventListener('activate', event => {
  console.log('[SW] Ativando Service Worker');
  
  event.waitUntil(
    Promise.all([
      // Limpar caches antigos
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE) {
              console.log('[SW] Removendo cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Tomar controle de todas as abas
      self.clients.claim()
    ])
  );
});

// ===== INTERCEPTAÇÃO DE REQUESTS =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorar requests de extensões do browser
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }
  
  // Estratégia para diferentes tipos de request
  if (request.method === 'GET') {
    if (isAPIRequest(url.pathname)) {
      event.respondWith(handleAPIRequest(request));
    } else if (isStaticFile(url.pathname)) {
      event.respondWith(handleStaticRequest(request));
    } else {
      event.respondWith(handleAppShellRequest(request));
    }
  } else {
    // POST, PUT, DELETE - sempre tentar rede primeiro
    event.respondWith(handleMutationRequest(request));
  }
});

// ===== ESTRATÉGIAS DE CACHE =====

// Network First para API (com fallback para cache)
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  
  try {
    console.log('[SW] Tentando rede para API:', url.pathname);
    
    const response = await fetch(request);
    
    if (response.ok) {
      // Cachear apenas GETs de leitura
      if (shouldCacheAPI(url.pathname)) {
        const cache = await caches.open(API_CACHE);
        const responseClone = response.clone();
        
        // Cache com TTL (adicionar header customizado)
        const cachedResponse = new Response(responseClone.body, {
          status: responseClone.status,
          statusText: responseClone.statusText,
          headers: {
            ...Object.fromEntries(responseClone.headers.entries()),
            'sw-cached': Date.now().toString(),
            'sw-cache-ttl': '300000' // 5 minutos
          }
        });
        
        await cache.put(request, cachedResponse);
        console.log('[SW] API response cached:', url.pathname);
      }
      
      return response;
    }
    
    throw new Error(`API responded with ${response.status}`);
    
  } catch (error) {
    console.log('[SW] Rede falhou, tentando cache:', error.message);
    
    const cache = await caches.open(API_CACHE);
    const cached = await cache.match(request);
    
    if (cached) {
      // Verificar TTL
      const cacheTime = cached.headers.get('sw-cached');
      const ttl = cached.headers.get('sw-cache-ttl') || '300000';
      
      if (cacheTime && (Date.now() - parseInt(cacheTime)) < parseInt(ttl)) {
        console.log('[SW] Retornando API do cache (válido)');
        return cached;
      } else {
        console.log('[SW] Cache API expirado, removendo');
        await cache.delete(request);
      }
    }
    
    // Retornar resposta offline padrão para API
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Sem conexão com a internet',
        offline: true,
        data: getOfflineData(url.pathname)
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json',
          'sw-offline': 'true'
        }
      }
    );
  }
}

// Cache First para arquivos estáticos
async function handleStaticRequest(request) {
  console.log('[SW] Buscando arquivo estático:', request.url);
  
  const cached = await caches.match(request);
  
  if (cached) {
    console.log('[SW] Arquivo estático do cache');
    return cached;
  }
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
      console.log('[SW] Arquivo estático cacheado');
    }
    
    return response;
    
  } catch (error) {
    console.error('[SW] Erro ao buscar arquivo estático:', error);
    
    // Retornar página offline básica se disponível
    return new Response('Arquivo não disponível offline', {
      status: 404,
      statusText: 'Not Found'
    });
  }
}

// App Shell - sempre retornar index.html para rotas SPA
async function handleAppShellRequest(request) {
  console.log('[SW] Requisição App Shell:', request.url);
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    
    return response;
    
  } catch (error) {
    console.log('[SW] Rede falhou, usando cache para App Shell');
    
    const cached = await caches.match('/');
    
    if (cached) {
      return cached;
    }
    
    // Página offline mínima
    return new Response(createOfflinePage(), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Network Only para mutations (POST, PUT, DELETE)
async function handleMutationRequest(request) {
  console.log('[SW] Requisição de mutação:', request.method, request.url);
  
  try {
    return await fetch(request);
    
  } catch (error) {
    console.log('[SW] Mutation falhou, salvando offline');
    
    // Salvar request para sincronização posterior
    await saveOfflineRequest(request);
    
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Sem conexão. Dados salvos para sincronizar quando voltar online.',
        offline: true,
        queued: true
      }),
      {
        status: 202,
        statusText: 'Accepted',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// ===== UTILITÁRIOS =====

function isAPIRequest(pathname) {
  return pathname.startsWith('/api/');
}

function isStaticFile(pathname) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff', '.woff2'];
  return staticExtensions.some(ext => pathname.includes(ext)) || pathname === '/manifest.json';
}

function shouldCacheAPI(pathname) {
  const cacheableRoutes = [
    '/api/categorias',
    '/api/dashboard'
  ];
  
  return cacheableRoutes.some(route => pathname.includes(route));
}

function getOfflineData(pathname) {
  // Retornar dados padrão offline baseados na rota
  const offlineData = {
    '/api/categorias': [
      { categoria: 'Imposto', tipo_padrao: 'Saída', ativo: true },
      { categoria: 'Contador', tipo_padrao: 'Saída', ativo: true },
      { categoria: 'Pró-labore', tipo_padrao: 'Saída', ativo: true },
      { categoria: 'Despesa', tipo_padrao: 'Saída', ativo: true },
      { categoria: 'Receita', tipo_padrao: 'Entrada', ativo: true }
    ],
    '/api/dashboard': {
      kpis: {
        totalEntradas: 0,
        totalImpostos: 0,
        totalProLabore: 0,
        totalDespesas: 0,
        saldoLiquido: 0
      },
      agendas: [],
      atrasados: []
    }
  };
  
  for (const route in offlineData) {
    if (pathname.includes(route)) {
      return offlineData[route];
    }
  }
  
  return null;
}

async function saveOfflineRequest(request) {
  try {
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text(),
      timestamp: Date.now()
    };
    
    // Usar IndexedDB para persistir requests offline
    const db = await openOfflineDB();
    const transaction = db.transaction(['offline_requests'], 'readwrite');
    const store = transaction.objectStore('offline_requests');
    
    await store.add(requestData);
    
    console.log('[SW] Request salva para sincronização:', requestData.url);
    
  } catch (error) {
    console.error('[SW] Erro ao salvar request offline:', error);
  }
}

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FinanceiroPJ_Offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('offline_requests')) {
        const store = db.createObjectStore('offline_requests', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        store.createIndex('timestamp', 'timestamp');
      }
    };
  });
}

function createOfflinePage() {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Offline - Controle Financeiro PJ</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: #f9fafb;
          color: #1f2937;
        }
        .offline-container {
          text-align: center;
          padding: 2rem;
          max-width: 400px;
        }
        .offline-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        .offline-title {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        .offline-description {
          color: #6b7280;
          margin-bottom: 2rem;
        }
        .retry-button {
          background: #4f46e5;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 0.5rem;
          font-size: 1rem;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">📱</div>
        <h1 class="offline-title">Você está offline</h1>
        <p class="offline-description">
          O Controle Financeiro PJ não está disponível no momento. 
          Verifique sua conexão com a internet.
        </p>
        <button class="retry-button" onclick="window.location.reload()">
          Tentar novamente
        </button>
      </div>
    </body>
    </html>
  `;
}

// ===== BACKGROUND SYNC =====
self.addEventListener('sync', event => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-offline-requests') {
    event.waitUntil(syncOfflineRequests());
  }
});

async function syncOfflineRequests() {
  try {
    console.log('[SW] Sincronizando requests offline...');
    
    const db = await openOfflineDB();
    const transaction = db.transaction(['offline_requests'], 'readonly');
    const store = transaction.objectStore('offline_requests');
    const requests = await store.getAll();
    
    console.log(`[SW] Encontradas ${requests.length} requests para sincronizar`);
    
    for (const requestData of requests) {
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });
        
        if (response.ok) {
          // Remover request sincronizada com sucesso
          const deleteTransaction = db.transaction(['offline_requests'], 'readwrite');
          const deleteStore = deleteTransaction.objectStore('offline_requests');
          await deleteStore.delete(requestData.id);
          
          console.log('[SW] Request sincronizada:', requestData.url);
        } else {
          console.log('[SW] Falha na sincronização:', requestData.url, response.status);
        }
        
      } catch (error) {
        console.log('[SW] Erro na sincronização individual:', error);
        // Manter request para tentar depois
      }
    }
    
  } catch (error) {
    console.error('[SW] Erro na sincronização geral:', error);
  }
}

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', event => {
  console.log('[SW] Push notification recebida');
  
  let notificationData = {
    title: 'Controle Financeiro PJ',
    body: 'Nova notificação',
    icon: '/icon-192x192.png',
    badge: '/icon-96x96.png',
    tag: 'financeiro-notification',
    requireInteraction: false,
    actions: []
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
      
      // Adicionar ações baseadas no tipo
      if (data.type === 'vencimento') {
        notificationData.actions = [
          {
            action: 'view',
            title: 'Ver Detalhes'
          },
          {
            action: 'pay',
            title: 'Marcar como Pago'
          }
        ];
      }
      
    } catch (error) {
      console.log('[SW] Erro ao parsear dados da notificação:', error);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  let url = '/';
  
  // Definir URL baseada na ação
  switch (event.action) {
    case 'view':
      url = '/?tab=agendas';
      break;
    case 'pay':
      url = '/?action=pay&id=' + (event.notification.data?.id || '');
      break;
    default:
      url = '/';
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Procurar janela já aberta
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        
        // Abrir nova janela se nenhuma estiver aberta
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// ===== CACHE CLEANUP =====
self.addEventListener('message', event => {
  console.log('[SW] Mensagem recebida:', event.data);
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(clearAllCaches());
  }
  
  if (event.data && event.data.type === 'SYNC_OFFLINE') {
    event.waitUntil(syncOfflineRequests());
  }
  
  if (event.data && event.data.type === 'GET_CACHE_STATUS') {
    event.waitUntil(getCacheStatus().then(status => {
      event.ports[0].postMessage(status);
    }));
  }
});

async function clearAllCaches() {
  console.log('[SW] Limpando todos os caches...');
  
  const cacheNames = await caches.keys();
  
  await Promise.all(
    cacheNames.map(cacheName => {
      console.log('[SW] Removendo cache:', cacheName);
      return caches.delete(cacheName);
    })
  );
  
  console.log('[SW] Todos os caches limpos');
}

async function getCacheStatus() {
  try {
    const [staticCache, apiCache] = await Promise.all([
      caches.open(CACHE_NAME),
      caches.open(API_CACHE)
    ]);
    
    const [staticKeys, apiKeys] = await Promise.all([
      staticCache.keys(),
      apiCache.keys()
    ]);
    
    return {
      static: {
        name: CACHE_NAME,
        size: staticKeys.length,
        items: staticKeys.map(req => req.url)
      },
      api: {
        name: API_CACHE,
        size: apiKeys.length,
        items: apiKeys.map(req => req.url)
      }
    };
    
  } catch (error) {
    console.error('[SW] Erro ao obter status do cache:', error);
    return { error: error.message };
  }
}

// ===== PERIODIC BACKGROUND SYNC =====
self.addEventListener('periodicsync', event => {
  console.log('[SW] Periodic sync triggered:', event.tag);
  
  if (event.tag === 'update-cache') {
    event.waitUntil(updatePeriodicCache());
  }
});

async function updatePeriodicCache() {
  try {
    console.log('[SW] Atualizando cache periódico...');
    
    // Atualizar dados essenciais
    const essentialRoutes = [
      '/api/categorias',
      '/api/dashboard'
    ];
    
    const cache = await caches.open(API_CACHE);
    
    for (const route of essentialRoutes) {
      try {
        const response = await fetch(route);
        if (response.ok) {
          await cache.put(route, response);
          console.log('[SW] Cache atualizado para:', route);
        }
      } catch (error) {
        console.log('[SW] Erro ao atualizar cache para:', route, error);
      }
    }
    
  } catch (error) {
    console.error('[SW] Erro na atualização periódica:', error);
  }
}

// ===== ERROR HANDLING =====
self.addEventListener('error', event => {
  console.error('[SW] Erro não capturado:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[SW] Promise rejeitada não capturada:', event.reason);
  event.preventDefault();
});

// ===== LOGGING E DEBUG =====
function logCacheInfo() {
  caches.keys().then(cacheNames => {
    console.log('[SW] Caches ativos:', cacheNames);
    
    cacheNames.forEach(cacheName => {
      caches.open(cacheName).then(cache => {
        cache.keys().then(keys => {
          console.log(`[SW] Cache ${cacheName}:`, keys.length, 'itens');
        });
      });
    });
  });
}

// Log inicial
console.log('[SW] Service Worker carregado - Controle Financeiro PJ v1.0.0');
console.log('[SW] Cache name:', CACHE_NAME);
console.log('[SW] API cache name:', API_CACHE);

// Executar log de info a cada 5 minutos (apenas se em desenvolvimento)
if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
  setInterval(logCacheInfo, 5 * 60 * 1000);
}