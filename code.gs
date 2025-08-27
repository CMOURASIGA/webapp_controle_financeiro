// ===== CÓDIGO APPS SCRIPT - Controle Financeiro PJ =====

// Configurações globais
const CONFIG = {
  SHEET_ID: PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '',
  PASTA_DRIVE_ID: PropertiesService.getScriptProperties().getProperty('PASTA_DRIVE_ID') || '',
  EMAIL_PADRAO: PropertiesService.getScriptProperties().getProperty('EMAIL_PADRAO') || '',
  WEBHOOK_URL: PropertiesService.getScriptProperties().getProperty('WEBHOOK_URL') || ''
};

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

// ===== INICIALIZAÇÃO E SETUP =====

function doGet(e) {
  try {
    const path = e.parameter.path || '';
    const params = e.parameter;
    
    // Verificar se usuário está logado
    const user = Session.getActiveUser();
    if (!user.getEmail()) {
      return HtmlService.createHtmlOutput('Acesso não autorizado. Faça login com sua conta Google.');
    }
    
    // Verificar e criar estrutura se necessário
    if (!CONFIG.SHEET_ID) {
      return criarEstruturainicial();
    }
    
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
    
    if (path === 'api/setup/verificar') {
      return apiResponse(verificarSetup());
    }
    
    // Servir HTML do frontend
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    
  } catch (error) {
    Logger.log('Erro no doGet: ' + error.toString());
    return apiResponse(null, error.message);
  }
}

function doPost(e) {
  try {
    const user = Session.getActiveUser();
    if (!user.getEmail()) {
      throw new Error('Acesso não autorizado');
    }
    
    const route = e.parameter.path || e.parameter.v || '';
    let data = {};
    
    try {
      data = JSON.parse(e.postData.contents || '{}');
    } catch (parseError) {
      Logger.log('Erro ao parsear JSON: ' + parseError.toString());
      throw new Error('Dados JSON inválidos');
    }
    
    let result;

    if (route === 'api/transacoes' || route === 'transacoes') {
      result = criarTransacao(data);
    } else if (route === 'api/agendas' || route === 'agendas') {
      result = criarAgenda(data);
    } else if (route === 'api/reservas' || route === 'reservas') {
      result = criarReserva(data);
    } else if (route === 'api/categorias' || route === 'categorias') {
      result = criarCategoria(data);
    } else if (route === 'api/setup/inicial' || route === 'setup/inicial') {
      result = setupInicial();
    } else if (route.match(/^api\/agendas\/[^/]+\/pagar$/)) {
      const agendaId = route.split('/')[2];
      result = pagarAgenda(agendaId);
    } else {
      throw new Error('Rota não encontrada: ' + route);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('Erro no doPost: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doDelete(e) {
  try {
    const user = Session.getActiveUser();
    if (!user.getEmail()) {
      throw new Error('Acesso não autorizado');
    }
    
    const route = e.parameter.path || e.parameter.v || '';
    let result;

    if (route === 'api/categorias') {
      const nome = e.parameter.categoria;
      result = deletarCategoria(nome);
    } else {
      throw new Error('Rota não encontrada');
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('Erro no doDelete: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== FUNÇÕES DE SETUP =====

function criarEstruturainicial() {
  try {
    const sheetId = setupInicial();
    
    // Salvar configurações
    PropertiesService.getScriptProperties().setProperties({
      'SHEET_ID': sheetId,
      'EMAIL_PADRAO': Session.getActiveUser().getEmail()
    });
    
    return HtmlService.createHtmlOutput(`
      <h2>Setup Inicial Concluído!</h2>
      <p>Planilha criada com ID: ${sheetId}</p>
      <p><a href="${SpreadsheetApp.openById(sheetId).getUrl()}" target="_blank">Abrir Planilha</a></p>
      <p><a href="${ScriptApp.getService().getUrl()}" target="_blank">Acessar Sistema</a></p>
    `);
  } catch (error) {
    return HtmlService.createHtmlOutput(`
      <h2>Erro no Setup</h2>
      <p>${error.message}</p>
    `);
  }
}

function verificarSetup() {
  const user = Session.getActiveUser();
  const sheetId = CONFIG.SHEET_ID;
  
  let planilhaExiste = false;
  let planilhaUrl = '';
  
  if (sheetId) {
    try {
      const ss = SpreadsheetApp.openById(sheetId);
      planilhaExiste = true;
      planilhaUrl = ss.getUrl();
    } catch (error) {
      planilhaExiste = false;
    }
  }
  
  return {
    usuario: user.getEmail(),
    planilhaConfigurada: !!sheetId,
    planilhaExiste: planilhaExiste,
    planilhaUrl: planilhaUrl,
    timezone: Session.getScriptTimeZone()
  };
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

function getTransacoes(params) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName('Transacoes');
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, i) => obj[header] = row[i]);
    return obj;
  });
}

function getAgendas(params) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName('Agendas');
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, i) => obj[header] = row[i]);
    return obj;
  });
}

function getReservas() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName('Reservas');
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, i) => obj[header] = row[i]);
    return obj;
  });
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
  }).filter(cat => cat.ativo !== false);
}

function criarTransacao(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName('Transacoes');
  
  const id = Utilities.getUuid();
  const agora = new Date();
  const timezone = data.timezone || DEFAULT_TIMEZONE;

  // Converter data do formato ISO para Date considerando timezone
  const dataTransacao = new Date(data.data + 'T12:00:00');

  const novaTransacao = [
    id,
    dataTransacao,
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
  const timezone = data.timezone || DEFAULT_TIMEZONE;
  
  // Converter data do formato ISO para Date
  const dataVencimento = new Date(data.data_vencimento + 'T12:00:00');
  
  const novaAgenda = [
    agendaId,
    data.tipo,
    data.descricao,
    Number(data.valor_previsto),
    dataVencimento,
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
  const timezone = data.timezone || DEFAULT_TIMEZONE;
  
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

function criarCategoria(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName('Categorias');

  const novaCategoria = [
    data.categoria,
    data.tipo_padrao || '',
    data.centro_custo || '',
    true
  ];

  sheet.appendRow(novaCategoria);
  
  logAuditoria('CREATE', 'Categoria', data.categoria, null, novaCategoria, Session.getActiveUser().getEmail());

  return { success: true };
}

function deletarCategoria(nome) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName('Categorias');

  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(r => r[0] === nome);

  if (rowIndex === -1) {
    throw new Error('Categoria não encontrada');
  }

  sheet.getRange(rowIndex + 1, 4).setValue(false);
  
  logAuditoria('DELETE', 'Categoria', nome, data[rowIndex], [nome, '', '', false], Session.getActiveUser().getEmail());

  return { success: true };
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
    data: new Date().toISOString().split('T')[0],
    tipo: agenda[1] === 'Pagar' ? 'Saída' : 'Entrada',
    categoria: 'Pagamento Agendado',
    descricao: agenda[2],
    valor: agenda[3],
    forma_pagto: 'Outros',
    status: 'Pago',
    vinculo_agenda_id: agendaId,
    timezone: DEFAULT_TIMEZONE
  };
  
  criarTransacao(transacaoData);
  
  // Atualizar status da agenda
  agendaSheet.getRange(agendaRow + 1, 7).setValue('Paga');
  agendaSheet.getRange(agendaRow + 1, 11).setValue(new Date());
  
  return { success: true };
}

// ===== FUNÇÕES DE APOIO =====

function atualizarStatusAgenda(agendaId, status) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName('Agendas');
  
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] === agendaId);
  
  if (rowIndex > 0) {
    sheet.getRange(rowIndex + 1, 7).setValue(status);
    sheet.getRange(rowIndex + 1, 11).setValue(new Date());
  }
}

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

function gerarParcelasRecorrentes(dadosOriginais, agendaIdOriginal) {
  // TODO: Implementar geração de parcelas recorrentes
  console.log('Gerando parcelas para:', agendaIdOriginal);
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

// ===== CONFIGURAÇÃO INICIAL =====

function setupInicial() {
  // Criar planilha modelo
  const sheetId = criarPlanilhaModelo();
  
  // Configurar triggers
  ScriptApp.newTrigger('verificarVencimentosDiarios')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
    
  console.log('Setup inicial concluído!');
  return sheetId;
}

function criarPlanilhaModelo() {
  const user = Session.getActiveUser();
  const ss = SpreadsheetApp.create(`Controle Financeiro PJ - ${user.getEmail()}`);
  
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
  
  // Aba Config
  const configSheet = ss.insertSheet('Config');
  configSheet.getRange('A1:B10').setValues([
    ['Configuração', 'Valor'],
    ['SHEET_ID', ss.getId()],
    ['EMAIL_PADRAO', user.getEmail()],
    ['TIMEZONE', DEFAULT_TIMEZONE],
    ['VERSAO', '1.0.0'],
    ['CRIADO_EM', new Date()],
    ['CRIADO_POR', user.getEmail()],
    ['PASTA_DRIVE_ID', ''],
    ['WEBHOOK_URL', ''],
    ['LAST_UPDATE', new Date()]
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

function marcarComoAtrasado(agendas) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName('Agendas');
  
  const data = sheet.getDataRange().getValues();
  
  agendas.forEach(agenda => {
    const rowIndex = data.findIndex(row => row[0] === agenda.agenda_id);
    if (rowIndex > 0) {
      sheet.getRange(rowIndex + 1, 7).setValue('Atrasada');
    }
  });
}