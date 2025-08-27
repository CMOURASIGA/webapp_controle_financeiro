// ===== CÓDIGO APPS SCRIPT - Controle Financeiro PJ =====

// Configurações globais
const CONFIG = {
  SHEET_ID: PropertiesService.getScriptProperties().getProperty('1JBux-TB-5U9nbQV3rDnEybGxeIaiFggWKw2FKAy64po') || '',
  PASTA_DRIVE_ID: PropertiesService.getScriptProperties().getProperty('1DVKACxn8ZMil2lK_l5SdgJVjXfcF5awQ') || '',
  EMAIL_PADRAO: PropertiesService.getScriptProperties().getProperty('cmourasiga@gmail.com') || '',
  WEBHOOK_URL: PropertiesService.getScriptProperties().getProperty('WEBHOOK_URL') || ''
};


// ===== FUNÇÕES PRINCIPAIS =====

function doGet(e) {
  try {
    const path = e.parameter.path || '';
    const params = e.parameter;
    
    // Rotas GET
    if (path.startsWith('api/mes/')) {
      const mes = path.replace('api/mes/', '');
      return apiResponse(getMesData(mes));
    }
    
    if (path === 'api/dashboard') {
      return apiResponse(getDashboard());
    }
    
    if (path === 'api/transacoes') {
      return apiResponse(getTransacoes(params));
    }
    
    if (path === 'api/agendas') {
      return apiResponse(getAgendas(params));
    }
    
    if (path === 'api/reservas') {
      return apiResponse(getReservas());
    }
    
    if (path === 'api/categorias') {
      return apiResponse(getCategorias());
    }
    
    // Servir HTML do frontend
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    
  } catch (error) {
    return apiResponse(null, error.message);
  }
}

function doPost(e) {
  try {
    const route = e.parameter.v;
    const data = JSON.parse(e.postData.contents);
    let result;

    if (route === 'transacoes') {
      result = criarTransacao(data);
    } else if (route === 'agendas') {
      result = criarAgenda(data);
    } else if (route === 'reservas') {
      result = criarReserva(data);
    } else {
      throw new Error('Rota não encontrada');
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('Erro no doPost: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== FUNÇÕES DA API =====

function getMesData(yyyymm) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheetTransacoes = ss.getSheetByName('Transacoes');
  
  const data = sheetTransacoes.getDataRange().getValues();
  const headers = data[0];
  
  const transacoes = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, i) => obj[header] = row[i]);
    return obj;
  }).filter(t => {
    const dataTransacao = new Date(t.data);
    const mesTransacao = `${dataTransacao.getFullYear()}-${String(dataTransacao.getMonth() + 1).padStart(2, '0')}`;
    return mesTransacao === yyyymm;
  });
  
  const totais = calcularTotaisMes(transacoes);
  
  return { transacoes, totais };
}

function getDashboard() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('dashboard');
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const dashboardSheet = ss.getSheetByName('Dashboard');
  
  const kpis = {
    totalEntradas: dashboardSheet.getRange('B2').getValue(),
    totalImpostos: dashboardSheet.getRange('B3').getValue(),
    totalProLabore: dashboardSheet.getRange('B4').getValue(),
    totalDespesas: dashboardSheet.getRange('B5').getValue(),
    saldoLiquido: dashboardSheet.getRange('B6').getValue()
  };
  
  const agendas = getProximosVencimentos();
  const atrasados = getAtrasados();
  
  const dashboard = { kpis, agendas, atrasados };
  
  cache.put('dashboard', JSON.stringify(dashboard), 300); // 5 min
  
  return dashboard;
}

function criarTransacao(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName('Transacoes');
  
  const agora = new Date();
  const timezone = Session.getScriptTimeZone();

  const novaTransacao = [
    id,
    new Date(data.data), // A data do formulário já vem correta
    data.tipo,
    data.categoria,
    data.descricao,
    Number(data.valor),
    data.forma_pagto,
    data.status || 'Pendente',
    data.vinculo_agenda_id || '',
    data.comprovante_url || '',
    Utilities.formatDate(agora, timezone, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    Utilities.formatDate(agora, timezone, "yyyy-MM-dd'T'HH:mm:ss'Z'")
  ];
  
  sheet.appendRow(novaTransacao);
  
  // Se vinculada a agenda e status = Pago, atualizar agenda
  if (data.vinculo_agenda_id && data.status === 'Pago') {
    atualizarStatusAgenda(data.vinculo_agenda_id, 'Paga');
  }
  
  logAuditoria('CREATE', 'Transacao', id, null, novaTransacao, Session.getActiveUser().getEmail());
  
  return { id, success: true };
}

function criarAgenda(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName('Agendas');
  
  const agendaId = Utilities.getUuid();
  const agora = new Date();
  const timezone = Session.getScriptTimeZone();
  
  const novaAgenda = [
    agendaId,
    data.tipo,
    data.descricao,
    Number(data.valor_previsto),
    new Date(data.data_vencimento),
    data.recorrencia || 'Nenhuma',
    'Aberta',
    data.notificar_em || '7;3;1',
    data.responsavel_email || CONFIG.EMAIL_PADRAO,
    Utilities.formatDate(agora, timezone, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    Utilities.formatDate(agora, timezone, "yyyy-MM-dd'T'HH:mm:ss'Z'")
  ];
  
  sheet.appendRow(novaAgenda);
  
  // Gerar parcelas recorrentes se necessário
  if (data.recorrencia && data.recorrencia !== 'Nenhuma' && data.parcelas > 1) {
    gerarParcelasRecorrentes(data, agendaId);
  }
  
  logAuditoria('CREATE', 'Agenda', agendaId, null, novaAgenda, Session.getActiveUser().getEmail());
  
  return { agendaId, success: true };
}

function criarReserva(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName('Reservas');
  
  const reservaId = Utilities.getUuid();
  const agora = new Date();
  const timezone = Session.getScriptTimeZone();
  
  const novaReserva = [
    reservaId,
    data.descricao,
    data.categoria,
    Number(data.valor_reservado),
    Utilities.formatDate(agora, timezone, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    Number(data.valor_reservado) // saldo inicial = valor reservado
  ];
  
  sheet.appendRow(novaReserva);
  
  logAuditoria('CREATE', 'Reserva', reservaId, null, novaReserva, Session.getActiveUser().getEmail());
  
  return { reservaId, success: true };
}

function pagarAgenda(agendaId) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const agendaSheet = ss.getSheetByName('Agendas');
  
  // Buscar agenda
  const data = agendaSheet.getDataRange().getValues();
  const agendaRow = data.findIndex(row => row[0] === agendaId);
  
  if (agendaRow === -1) {
    throw new Error('Agenda não encontrada');
  }
  
  const agenda = data[agendaRow];
  
  // Criar transação automaticamente
  const transacaoData = {
    data: new Date(),
    tipo: agenda[1] === 'Pagar' ? 'Saída' : 'Entrada',
    categoria: 'Pagamento Agendado',
    descricao: agenda[2],
    valor: agenda[3],
    forma_pagto: 'Outros',
    status: 'Pago',
    vinculo_agenda_id: agendaId
  };
  
  criarTransacao(transacaoData);
  
  // Atualizar status da agenda
  agendaSheet.getRange(agendaRow + 1, 7).setValue('Paga');
  agendaSheet.getRange(agendaRow + 1, 11).setValue(new Date());
  
  return { success: true };
}

// ===== FUNÇÕES DE APOIO =====

function calcularTotaisMes(transacoes) {
  const totais = {
    entradas: 0,
    saidas: 0,
    impostos: 0,
    proLabore: 0,
    despesas: 0,
    investimentos: 0
  };
  
  transacoes.forEach(t => {
    if (t.status !== 'Pago') return;
    
    const valor = Number(t.valor);
    
    if (t.tipo === 'Entrada') {
      totais.entradas += valor;
      if (t.categoria === 'Investimento') totais.investimentos += valor;
    } else if (t.tipo === 'Saída') {
      totais.saidas += valor;
      if (t.categoria === 'Imposto' || t.categoria === 'Contador') {
        totais.impostos += valor;
      } else if (t.categoria === 'Pró-labore') {
        totais.proLabore += valor;
      } else {
        totais.despesas += valor;
      }
    }
  });
  
  return totais;
}

function getProximosVencimentos() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName('Agendas');
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const hoje = new Date();
  const proximosDias = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, i) => obj[header] = row[i]);
    return obj;
  }).filter(agenda => {
    const vencimento = new Date(agenda.data_vencimento);
    return agenda.status !== 'Paga' && vencimento >= hoje && vencimento <= proximosDias;
  });
}

function getAtrasados() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName('Agendas');
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const hoje = new Date();
  
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, i) => obj[header] = row[i]);
    return obj;
  }).filter(agenda => {
    const vencimento = new Date(agenda.data_vencimento);
    return agenda.status !== 'Paga' && vencimento < hoje;
  });
}

function uploadComprovante(fileBlob, transacaoId) {
  if (!CONFIG.PASTA_DRIVE_ID) {
    throw new Error('PASTA_DRIVE_ID não configurada');
  }
  
  const pasta = DriveApp.getFolderById(CONFIG.PASTA_DRIVE_ID);
  const arquivo = pasta.createFile(fileBlob);
  const url = arquivo.getUrl();
  
  // Atualizar transação com URL do comprovante
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName('Transacoes');
  const data = sheet.getDataRange().getValues();
  
  const rowIndex = data.findIndex(row => row[0] === transacaoId);
  if (rowIndex > 0) {
    sheet.getRange(rowIndex + 1, 10).setValue(url); // coluna comprovante_url
  }
  
  return url;
}

// ===== TRIGGERS E NOTIFICAÇÕES =====

function verificarVencimentosDiarios() {
  try {
    const agendas = getProximosVencimentos();
    const atrasados = getAtrasados();
    
    // Marcar como atrasado
    if (atrasados.length > 0) {
      marcarComoAtrasado(atrasados);
    }
    
    // Enviar notificações
    if (agendas.length > 0 || atrasados.length > 0) {
      enviarNotificacoes(agendas, atrasados);
    }
    
  } catch (error) {
    logError('verificarVencimentosDiarios', error.message);
  }
}

function enviarNotificacoes(proximos, atrasados) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  
  let html = `
    <h2>Resumo Financeiro - ${hoje}</h2>
    
    <h3>📅 Próximos Vencimentos (7 dias)</h3>
    <ul>
      ${proximos.map(a => `<li>${a.descricao} - R$ ${a.valor_previsto} - ${new Date(a.data_vencimento).toLocaleDateString('pt-BR')}</li>`).join('')}
    </ul>
    
    <h3>⚠️ Em Atraso</h3>
    <ul>
      ${atrasados.map(a => `<li>${a.descricao} - R$ ${a.valor_previsto} - ${new Date(a.data_vencimento).toLocaleDateString('pt-BR')}</li>`).join('')}
    </ul>
  `;
  
  // Email
  if (CONFIG.EMAIL_PADRAO) {
    GmailApp.sendEmail(
      CONFIG.EMAIL_PADRAO,
      `Resumo Financeiro PJ - ${hoje}`,
      '',
      { htmlBody: html }
    );
  }
  
  // Webhook (opcional)
  if (CONFIG.WEBHOOK_URL) {
    const payload = {
      proximos: proximos.length,
      atrasados: atrasados.length,
      data: hoje
    };
    
    UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
  }
}

// ===== AUDITORIA E LOGS =====

function logAuditoria(acao, entidade, entityId, antes, depois, usuario) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const logSheet = ss.getSheetByName('Log');
    
    const logEntry = [
      new Date(),
      acao,
      entidade,
      entityId,
      JSON.stringify(antes),
      JSON.stringify(depois),
      usuario
    ];
    
    logSheet.appendRow(logEntry);
  } catch (error) {
    console.error('Erro no log de auditoria:', error);
  }
}

function logError(funcao, erro) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const errorSheet = ss.getSheetByName('Erros');
    
    errorSheet.appendRow([
      new Date(),
      funcao,
      erro,
      Session.getActiveUser().getEmail()
    ]);
  } catch (e) {
    console.error('Erro ao logar erro:', e);
  }
}

// ===== FUNÇÕES UTILITÁRIAS =====

function apiResponse(data, error = null) {
  const response = {
    ok: !error,
    data: data,
    error: error,
    timestamp: new Date().toISOString()
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function getCategorias() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName('Categorias');
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, i) => obj[header] = row[i]);
    return obj;
  }).filter(cat => cat.ativo);
}

// ===== CONFIGURAÇÃO INICIAL =====

function setupInicial() {
  // Criar planilha modelo
  criarPlanilhaModelo();
  
  // Configurar triggers
  ScriptApp.newTrigger('verificarVencimentosDiarios')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
    
  console.log('Setup inicial concluído!');
}

function criarPlanilhaModelo() {
  const ss = SpreadsheetApp.create('Controle Financeiro PJ');
  
  // Aba Transacoes
  const transacoesSheet = ss.insertSheet('Transacoes');
  transacoesSheet.getRange('A1:L1').setValues([[
    'id', 'data', 'tipo', 'categoria', 'descricao', 'valor', 
    'forma_pagto', 'status', 'vinculo_agenda_id', 'comprovante_url', 
    'criado_em', 'atualizado_em'
  ]]);
  
  // Aba Agendas
  const agendasSheet = ss.insertSheet('Agendas');
  agendasSheet.getRange('A1:K1').setValues([[
    'agenda_id', 'tipo', 'descricao', 'valor_previsto', 'data_vencimento',
    'recorrencia', 'status', 'notificar_em', 'responsavel_email', 
    'criado_em', 'atualizado_em'
  ]]);
  
  // Aba Reservas
  const reservasSheet = ss.insertSheet('Reservas');
  reservasSheet.getRange('A1:F1').setValues([[
    'reserva_id', 'descricao', 'categoria', 'valor_reservado', 'data_reserva', 'saldo_reserva'
  ]]);
  
  // Aba Categorias
  const categoriasSheet = ss.insertSheet('Categorias');
  categoriasSheet.getRange('A1:D1').setValues([['categoria', 'tipo_padrao', 'centro_custo', 'ativo']]);
  categoriasSheet.getRange('A2:D10').setValues([
    ['Imposto', 'Saída', '', true],
    ['Contador', 'Saída', '', true],
    ['Pró-labore', 'Saída', '', true],
    ['Despesa', 'Saída', '', true],
    ['Investimento', 'Entrada', '', true],
    ['Receita', 'Entrada', '', true],
    ['Transferência', 'Transferência', '', true],
    ['Material', 'Saída', '', true],
    ['Equipamento', 'Saída', '', true]
  ]);
  
  // Aba Dashboard
  const dashboardSheet = ss.insertSheet('Dashboard');
  dashboardSheet.getRange('A1:B6').setValues([
    ['KPI', 'Valor'],
    ['Total Entradas', '=SUMIF(Transacoes!C:C,"Entrada",Transacoes!F:F)'],
    ['Total Impostos', '=SUMIFS(Transacoes!F:F,Transacoes!D:D,"Imposto",Transacoes!H:H,"Pago")+SUMIFS(Transacoes!F:F,Transacoes!D:D,"Contador",Transacoes!H:H,"Pago")'],
    ['Total Pró-labore', '=SUMIFS(Transacoes!F:F,Transacoes!D:D,"Pró-labore",Transacoes!H:H,"Pago")'],
    ['Total Despesas', '=SUMIFS(Transacoes!F:F,Transacoes!C:C,"Saída",Transacoes!H:H,"Pago")-B3-B4'],
    ['Saldo Líquido', '=B2-B3-B4-B5']
  ]);
  
  // Abas de Log e Erros
  const logSheet = ss.insertSheet('Log');
  logSheet.getRange('A1:G1').setValues([['timestamp', 'acao', 'entidade', 'entity_id', 'antes', 'depois', 'usuario']]);
  
  const errorSheet = ss.insertSheet('Erros');
  errorSheet.getRange('A1:D1').setValues([['timestamp', 'funcao', 'erro', 'usuario']]);
  
  console.log('Planilha criada:', ss.getUrl());
  console.log('SHEET_ID:', ss.getId());
  
  return ss.getId();
}