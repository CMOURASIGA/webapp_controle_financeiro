// --- Code.gs - Versão Corrigida ---

// Configurações do Script
const PASTA_DRIVE_ID = 'SEU_ID_DA_PASTA_DO_DRIVE_PARA_COMPROVANTES'; // Opcional
const WEBHOOK_URL = 'URL_DO_WEBHOOK_OPCIONAL'; // Opcional

// Função principal para obter ou criar a planilha do usuário
function checkAndGetSpreadsheetId() {
  const userEmail = Session.getActiveUser().getEmail();
  
  // Primeiro, tenta buscar o ID da planilha nas propriedades do usuário
  const userProperties = PropertiesService.getUserProperties();
  let sheetId = userProperties.getProperty('SPREADSHEET_ID');
  
  if (sheetId) {
    try {
      // Verifica se a planilha ainda existe e é acessível
      SpreadsheetApp.openById(sheetId);
      Logger.log(`Planilha encontrada nas propriedades do usuário: ${sheetId}`);
      return sheetId;
    } catch (e) {
      Logger.log(`Planilha salva nas propriedades não é mais acessível: ${e.message}`);
      userProperties.deleteProperty('SPREADSHEET_ID');
    }
  }
  
  // Se não encontrou nas propriedades, busca por nome
  const spreadsheetName = `Controle Financeiro PJ (${userEmail})`;
  const files = DriveApp.getFilesByName(spreadsheetName);
  
  if (files.hasNext()) {
    const file = files.next();
    sheetId = file.getId();
    // Salva o ID nas propriedades do usuário para acesso futuro mais rápido
    userProperties.setProperty('SPREADSHEET_ID', sheetId);
    Logger.log(`Planilha existente encontrada para o usuário ${userEmail}. ID: ${sheetId}`);
    return sheetId;
  } else {
    // Se a planilha não for encontrada, criar uma nova
    Logger.log(`Planilha não encontrada para o usuário ${userEmail}. Criando nova...`);
    try {
      sheetId = createSpreadsheetFromScratch();
      userProperties.setProperty('SPREADSHEET_ID', sheetId);
      // Criar categorias padrão APÓS a criação da planilha
      createDefaultCategories(sheetId);
      return sheetId;
    } catch (e) {
      Logger.log(`Falha crítica ao criar a planilha do zero. Erro: ${e.message}`);
      throw new Error("Não foi possível criar a planilha de controle financeiro. Entre em contato com o suporte.");
    }
  }
}

// Função para criar uma nova planilha do zero
function createSpreadsheetFromScratch() {
  const userEmail = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.create(`Controle Financeiro PJ (${userEmail})`);
  
  // Criação das abas e cabeçalhos essenciais
  const transacoesSheet = ss.insertSheet('Transacoes');
  transacoesSheet.getRange('A1:F1').setValues([['data_transacao', 'tipo', 'categoria', 'descricao', 'valor', 'timestamp']]);

  const agendasSheet = ss.insertSheet('Agendas');
  agendasSheet.getRange('A1:E1').setValues([['data_vencimento', 'descricao', 'tipo', 'valor_previsto', 'status']]);

  const reservasSheet = ss.insertSheet('Reservas');
  reservasSheet.getRange('A1:C1').setValues([['descricao', 'valor_reservado', 'data_reserva']]);

  const dashboardSheet = ss.insertSheet('Dashboard');
  dashboardSheet.getRange('A1:B3').setValues([['KPI', 'VALOR'], ['Saldo Líquido', 0], ['Próximo Vencimento', '']]);

  const categoriasSheet = ss.insertSheet('Categorias');
  categoriasSheet.getRange('A1:D1').setValues([['categoria', 'tipoPadrao', 'centroCusto', 'ativo']]);

  // Remove a aba padrão que vem com a planilha
  try {
    ss.deleteSheet(ss.getSheetByName('Sheet1'));
  } catch (e) {
    Logger.log('Aba Sheet1 não encontrada para remoção');
  }

  return ss.getId();
}

// Função para criar categorias padrão
function createDefaultCategories(sheetId) {
  try {
    const defaultCategories = [
      { categoria: 'Vendas', tipoPadrao: 'Entrada', centroCusto: 'Receitas', ativo: true },
      { categoria: 'Prestação de Serviços', tipoPadrao: 'Entrada', centroCusto: 'Receitas', ativo: true },
      { categoria: 'Aluguel', tipoPadrao: 'Saída', centroCusto: 'Despesas Fixas', ativo: true },
      { categoria: 'Energia Elétrica', tipoPadrao: 'Saída', centroCusto: 'Despesas Fixas', ativo: true },
      { categoria: 'Internet', tipoPadrao: 'Saída', centroCusto: 'Despesas Fixas', ativo: true },
      { categoria: 'Material de Escritório', tipoPadrao: 'Saída', centroCusto: 'Despesas Operacionais', ativo: true },
      { categoria: 'Marketing', tipoPadrao: 'Saída', centroCusto: 'Despesas Operacionais', ativo: true },
      { categoria: 'Impostos', tipoPadrao: 'Saída', centroCusto: 'Impostos e Taxas', ativo: true },
      { categoria: 'Taxas Bancárias', tipoPadrao: 'Saída', centroCusto: 'Despesas Financeiras', ativo: true }
    ];

    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Categorias');
    
    defaultCategories.forEach(categoria => {
      const newRow = [
        categoria.categoria,
        categoria.tipoPadrao,
        categoria.centroCusto || '',
        categoria.ativo !== false
      ];
      sheet.appendRow(newRow);
    });
    
    Logger.log('Categorias padrão criadas com sucesso');
  } catch (error) {
    Logger.log(`Erro ao criar categorias padrão: ${error.message}`);
  }
}

// Funções utilitárias
function getSpreadsheet() {
  const sheetId = checkAndGetSpreadsheetId();
  if (!sheetId) {
    throw new Error("ID da planilha do usuário não encontrado. Tente novamente.");
  }
  return SpreadsheetApp.openById(sheetId);
}

function getSheetByName(name) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error(`Aba '${name}' não encontrada na planilha.`);
  }
  return sheet;
}

// Função principal para servir a página HTML
function doGet(e) {
  try {
    // Garante que a planilha existe
    const sheetId = checkAndGetSpreadsheetId();
    
    const template = HtmlService.createTemplateFromFile('index');
    template.sheetId = sheetId;
    
    return template.evaluate()
      .setTitle('Controle Financeiro PJ')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    Logger.log(`Erro no doGet: ${error.message}`);
    return HtmlService.createHtmlOutput(`
      <h1>Erro</h1>
      <p>${error.message}</p>
      <p>Tente recarregar a página ou entre em contato com o suporte.</p>
    `);
  }
}

// CORRIGIDO: Função para roteamento simplificado
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    Logger.log(`Requisição POST: ${JSON.stringify(payload)}`);
    
    const endpoint = payload.endpoint;
    const data = payload.data;
    let result;
    
    switch (endpoint) {
      case '/api/categorias/create':
        result = createCategoria(data);
        break;
      case '/api/transacoes':
        result = createTransacao(data);
        break;
      case '/api/agendas':
        result = createAgenda(data);
        break;
      case '/api/reservas':
        result = createReserva(data);
        break;
      default:
        result = { success: false, error: 'Endpoint não encontrado' };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log(`Erro no doPost: ${error.message}`);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// === FUNÇÕES DE API CORRIGIDAS ===

// NOVA: Função unificada para buscar dados (chamada diretamente do frontend)
function getCategorias() {
  try {
    const sheet = getSheetByName('Categorias');
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return { success: true, data: [] };
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
    const categorias = rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    }).filter(categoria => categoria.ativo !== false);
    
    return { success: true, data: categorias };
  } catch (error) {
    Logger.log(`Erro ao buscar categorias: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function createCategoria(data) {
  try {
    // Validações básicas
    if (!data.categoria || !data.tipoPadrao) {
      throw new Error('Categoria e tipo padrão são obrigatórios');
    }
    
    const sheet = getSheetByName('Categorias');
    
    // Verificar se já existe uma categoria com o mesmo nome
    const existingData = sheet.getDataRange().getValues();
    const existingCategories = existingData.slice(1).map(row => row[0]);
    
    if (existingCategories.includes(data.categoria)) {
      throw new Error('Já existe uma categoria com este nome');
    }
    
    const newRow = [
      data.categoria,
      data.tipoPadrao,
      data.centroCusto || '',
      data.ativo !== false
    ];
    
    sheet.appendRow(newRow);
    
    Logger.log(`Categoria criada: ${data.categoria}`);
    return { success: true, data: { message: 'Categoria criada com sucesso.' } };
  } catch (error) {
    Logger.log(`Erro ao criar categoria: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Transações
function getTransacoes() {
  try {
    const sheet = getSheetByName('Transacoes');
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return { success: true, data: [] };
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
    const transacoes = rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
    
    return { success: true, data: transacoes };
  } catch (error) {
    Logger.log(`Erro ao buscar transações: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function createTransacao(data) {
  try {
    // Validações básicas
    if (!data.data_transacao || !data.tipo || !data.categoria || !data.descricao || !data.valor) {
      throw new Error('Todos os campos são obrigatórios');
    }
    
    if (isNaN(data.valor) || data.valor <= 0) {
      throw new Error('Valor deve ser um número positivo');
    }
    
    const sheet = getSheetByName('Transacoes');
    const newRow = [
      new Date(data.data_transacao),
      data.tipo,
      data.categoria,
      data.descricao,
      parseFloat(data.valor),
      new Date()
    ];
    
    sheet.appendRow(newRow);
    
    Logger.log(`Transação criada: ${data.tipo} - ${data.descricao} - R$ ${data.valor}`);
    return { success: true, data: { message: 'Transação criada com sucesso.' } };
  } catch (error) {
    Logger.log(`Erro ao criar transação: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Agendas
function getAgendas() {
  try {
    const sheet = getSheetByName('Agendas');
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return { success: true, data: [] };
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
    const agendas = rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
    
    return { success: true, data: agendas };
  } catch (error) {
    Logger.log(`Erro ao buscar agendas: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function createAgenda(data) {
  try {
    // Validações básicas
    if (!data.data_vencimento || !data.descricao || !data.tipo || !data.valor_previsto) {
      throw new Error('Todos os campos são obrigatórios');
    }
    
    if (isNaN(data.valor_previsto) || data.valor_previsto <= 0) {
      throw new Error('Valor previsto deve ser um número positivo');
    }
    
    const sheet = getSheetByName('Agendas');
    const newRow = [
      new Date(data.data_vencimento),
      data.descricao,
      data.tipo,
      parseFloat(data.valor_previsto),
      'Pendente'
    ];
    
    sheet.appendRow(newRow);
    
    Logger.log(`Agendamento criado: ${data.descricao} - ${data.data_vencimento}`);
    return { success: true, data: { message: 'Agendamento criado com sucesso.' } };
  } catch (error) {
    Logger.log(`Erro ao criar agendamento: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Reservas
function getReservas() {
  try {
    const sheet = getSheetByName('Reservas');
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return { success: true, data: [] };
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
    const reservas = rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
    
    return { success: true, data: reservas };
  } catch (error) {
    Logger.log(`Erro ao buscar reservas: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function createReserva(data) {
  try {
    // Validações básicas
    if (!data.descricao || !data.valor_reservado) {
      throw new Error('Descrição e valor são obrigatórios');
    }
    
    if (isNaN(data.valor_reservado) || data.valor_reservado <= 0) {
      throw new Error('Valor da reserva deve ser um número positivo');
    }
    
    const sheet = getSheetByName('Reservas');
    const newRow = [
      data.descricao,
      parseFloat(data.valor_reservado),
      new Date()
    ];
    
    sheet.appendRow(newRow);
    
    Logger.log(`Reserva criada: ${data.descricao} - R$ ${data.valor_reservado}`);
    return { success: true, data: { message: 'Reserva criada com sucesso.' } };
  } catch (error) {
    Logger.log(`Erro ao criar reserva: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Dashboard
function getDashboard() {
  try {
    const transacoesSheet = getSheetByName('Transacoes');
    const agendasSheet = getSheetByName('Agendas');
    const reservasSheet = getSheetByName('Reservas');
    
    // Calcular saldo líquido
    let saldoLiquido = 0;
    const transacoesData = transacoesSheet.getDataRange().getValues();
    if (transacoesData.length > 1) {
      for (let i = 1; i < transacoesData.length; i++) {
        const tipo = transacoesData[i][1];
        const valor = transacoesData[i][4];
        if (typeof valor === 'number') {
          if (tipo === 'Entrada') {
            saldoLiquido += valor;
          } else if (tipo === 'Saída') {
            saldoLiquido -= valor;
          }
        }
      }
    }
    
    // Próximos vencimentos
    const proximosVencimentos = [];
    const agendasData = agendasSheet.getDataRange().getValues();
    if (agendasData.length > 1) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0); // Zerar horário para comparação apenas de data
      
      for (let i = 1; i < agendasData.length; i++) {
        const dataVencimento = new Date(agendasData[i][0]);
        const status = agendasData[i][4];
        
        if (status === 'Pendente' && dataVencimento >= hoje) {
          proximosVencimentos.push({
            data_vencimento: agendasData[i][0],
            descricao: agendasData[i][1],
            tipo: agendasData[i][2],
            valor_previsto: agendasData[i][3]
          });
        }
      }
    }
    
    // Ordenar por data de vencimento
    proximosVencimentos.sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
    
    Logger.log(`Dashboard calculado - Saldo: R$ ${saldoLiquido}, Vencimentos: ${proximosVencimentos.length}`);
    
    return {
      success: true,
      data: {
        kpis: {
          saldoLiquido: saldoLiquido
        },
        proximosVencimentos: proximosVencimentos.slice(0, 5) // Apenas os próximos 5
      }
    };
  } catch (error) {
    Logger.log(`Erro ao calcular dashboard: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Função auxiliar para incluir arquivos HTML/CSS/JS
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// NOVAS FUNÇÕES PARA CORRIGIR A COMUNICAÇÃO FRONTEND-BACKEND

// Função para salvar transação (chamada diretamente do frontend)
function salvarTransacao(data) {
  return createTransacao(data);
}

// Função para salvar agenda (chamada diretamente do frontend)  
function salvarAgenda(data) {
  return createAgenda(data);
}

// Função para salvar reserva (chamada diretamente do frontend)
function salvarReserva(data) {
  return createReserva(data);
}

// Função para salvar categoria (chamada diretamente do frontend)
function salvarCategoria(data) {
  return createCategoria(data);
}

// Função para teste e debug
function testCreateDefaultCategories() {
  try {
    // Para testar, você precisaria de um sheetId válido
    // createDefaultCategories(checkAndGetSpreadsheetId()); 
    Logger.log('Teste de criação de categorias padrão concluído');
  } catch (error) {
    Logger.log(`Erro no teste: ${error.message}`);
  }
}
// Função para debug - adicione no Code.gs
function getDebugInfo() {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const sheetId = checkAndGetSpreadsheetId();
    
    return {
      success: true,
      sheetId: sheetId,
      userEmail: userEmail
    };
  } catch (error) {
    Logger.log(`Erro no debug: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}
// Adicione estas funções ao seu Code.gs

// Função para debug - mostra informações da planilha e usuário
function getDebugInfo() {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const sheetId = checkAndGetSpreadsheetId();
    
    return {
      success: true,
      sheetId: sheetId,
      userEmail: userEmail,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`
    };
  } catch (error) {
    Logger.log(`Erro ao obter debug info: ${error.message}`);
    return {
      success: false,
      error: error.message,
      userEmail: Session.getActiveUser().getEmail(),
      sheetId: 'Erro ao acessar'
    };
  }
}

// Função melhorada para salvar transação com mais logs
function salvarTransacao(data) {
  try {
    Logger.log(`=== INICIANDO SALVAMENTO DE TRANSAÇÃO ===`);
    Logger.log(`Dados recebidos: ${JSON.stringify(data)}`);
    
    // Validações detalhadas
    if (!data.data_transacao) {
      throw new Error('Data da transação é obrigatória');
    }
    if (!data.tipo) {
      throw new Error('Tipo da transação é obrigatório');
    }
    if (!data.categoria) {
      throw new Error('Categoria é obrigatória');
    }
    if (!data.descricao) {
      throw new Error('Descrição é obrigatória');
    }
    if (!data.valor || isNaN(data.valor) || data.valor <= 0) {
      throw new Error('Valor deve ser um número positivo');
    }
    
    const sheetId = checkAndGetSpreadsheetId();
    Logger.log(`ID da planilha: ${sheetId}`);
    
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Transacoes');
    
    if (!sheet) {
      throw new Error('Aba "Transacoes" não encontrada na planilha');
    }
    
    Logger.log(`Aba Transacoes encontrada. Última linha: ${sheet.getLastRow()}`);
    
    const newRow = [
      new Date(data.data_transacao),
      data.tipo,
      data.categoria,
      data.descricao,
      parseFloat(data.valor),
      new Date()
    ];
    
    Logger.log(`Dados para inserir: ${JSON.stringify(newRow)}`);
    
    sheet.appendRow(newRow);
    
    Logger.log(`Transação inserida com sucesso. Nova última linha: ${sheet.getLastRow()}`);
    Logger.log(`=== TRANSAÇÃO SALVA COM SUCESSO ===`);
    
    return { 
      success: true, 
      data: { 
        message: 'Transação criada com sucesso.',
        rowNumber: sheet.getLastRow()
      } 
    };
  } catch (error) {
    Logger.log(`=== ERRO AO SALVAR TRANSAÇÃO ===`);
    Logger.log(`Erro: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return { success: false, error: error.message };
  }
}