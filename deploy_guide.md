# 🚀 Guia de Deploy - Controle Financeiro PJ

## 📋 Pré-requisitos

- Conta Google (Gmail/Workspace)
- Acesso ao Google Drive
- Navegador moderno (Chrome, Firefox, Safari, Edge)

## 🔧 Passo a Passo Completo

### 1. Criar Projeto no Google Apps Script

1. **Acesse**: [script.google.com](https://script.google.com)
2. **Clique**: "Novo projeto"
3. **Renomeie**: Para "Controle Financeiro PJ"

### 2. Configurar Backend

#### 2.1 Arquivo Principal (Code.gs)
1. **Substitua** o código padrão pelo conteúdo do backend
2. **Salve** (Ctrl+S)

#### 2.2 Arquivo HTML (index.html)
1. **Clique** no "+" ao lado de "Arquivos"
2. **Selecione** "HTML"
3. **Nomeie** como "index"
4. **Cole** o código do frontend
5. **Salve**

#### 2.3 Service Worker (sw.js) - Opcional
1. **Adicione** novo arquivo HTML
2. **Nomeie** como "sw"
3. **Cole** o código do service worker
4. **Salve**

#### 2.4 Manifest PWA (manifest.json) - Opcional
1. **Adicione** novo arquivo HTML
2. **Nomeie** como "manifest"  
3. **Cole** o código do manifest
4. **Salve**

### 3. Executar Setup Inicial

1. **No menu** "Executar" → **Selecionar função** → `setupInicial`
2. **Clique** "Executar"
3. **Autorize** as permissões solicitadas:
   - ✅ Ver e gerenciar planilhas do Google Drive
   - ✅ Ver e gerenciar arquivos do Google Drive  
   - ✅ Enviar emails
   - ✅ Executar como aplicativo da web
4. **Aguarde** a criação da planilha (pode demorar 1-2 minutos)
5. **Copie** a URL da planilha criada que aparecerá no log

### 4. Configurar Propriedades

#### 4.1 Acessar Configurações
1. **Clique** no ⚙️ "Configurações do projeto"
2. **Vá** para aba "Propriedades do script"
3. **Adicione** as seguintes propriedades:

#### 4.2 Propriedades Obrigatórias
```
SHEET_ID = 1ABC...XYZ (ID da planilha criada)
EMAIL_PADRAO = seu@email.com
```

#### 4.3 Propriedades Opcionais
```
PASTA_DRIVE_ID = 1DEF...UVW (para upload de comprovantes)
WEBHOOK_URL = https://api.webhook.com/... (notificações externas)
```

> 💡 **Como obter SHEET_ID**: Da URL da planilha `https://docs.google.com/spreadsheets/d/ID_AQUI/edit`, copie apenas o ID_AQUI

### 5. Criar Pasta para Comprovantes (Opcional)

1. **Acesse** [drive.google.com](https://drive.google.com)
2. **Crie** nova pasta "Comprovantes Financeiro PJ"
3. **Copie** o ID da pasta da URL
4. **Adicione** como `PASTA_DRIVE_ID` nas propriedades

### 6. Deploy do Web App

#### 6.1 Nova Implantação
1. **Clique** "Implantar" → "Nova implantação"
2. **Clique** no ⚙️ ao lado de "Tipo"
3. **Selecione** "Aplicativo da web"

#### 6.2 Configurações de Deploy
```
Descrição: v1.0.0 - Deploy inicial
Executar como: Eu (seu@email.com)
Quem tem acesso: Somente eu
```

#### 6.3 Finalizar Deploy
1. **Clique** "Implantar"
2. **Copie** a URL do Web App
3. **Teste** abrindo a URL em nova aba

### 7. Configurar Triggers (Notificações)

#### 7.1 Trigger Automático
O `setupInicial` já criou o trigger diário, mas para verificar:

1. **Vá** em ⏰ "Acionadores"
2. **Deve** aparecer: `verificarVencimentosDiarios`
   - **Função**: verificarVencimentosDiarios
   - **Origem do evento**: Baseado no tempo
   - **Tipo**: Timer diário
   - **Hora**: 8h às 9h

#### 7.2 Criar Trigger Manual (se necessário)
1. **Clique** "+ Adicionar acionador"
2. **Configure**:
   - Função: `verificarVencimentosDiarios`
   - Origem: Baseado no tempo
   - Tipo: Timer diário
   - Hora: 8h às 9h
3. **Salvar**

### 8. Testar Funcionalidades

#### 8.1 Teste Básico
1. **Abra** a URL do Web App
2. **Verifique** se carrega a interface
3. **Teste** criar nova transação
4. **Verifique** se aparece na planilha

#### 8.2 Teste de Notificação
1. **Execute** manualmente `verificarVencimentosDiarios`
2. **Verifique** se recebeu email (se houver agendas)

#### 8.3 Teste Mobile
1. **Abra** no celular/tablet
2. **Teste** responsividade
3. **Adicione** à tela inicial (PWA)

## 📱 Configurar PWA no Mobile

### Android (Chrome)
1. **Abra** o webapp no Chrome
2. **Toque** no menu ⋮
3. **Selecione** "Adicionar à tela inicial"
4. **Confirme** "Adicionar"

### iOS (Safari)
1. **Abra** o webapp no Safari  
2. **Toque** no ícone de compartilhar 📤
3. **Selecione** "Adicionar à Tela de Início"
4. **Confirme** "Adicionar"

## 🔄 Como Atualizar o Sistema

### Atualização de Código
1. **Edite** os arquivos no Apps Script
2. **Salve** as alterações
3. **Vá** em "Implantar" → "Gerenciar implantações"
4. **Clique** no ✏️ da implantação ativa
5. **Selecione** "Nova versão"
6. **Atualize** a descrição
7. **Clique** "Implantar"

### Atualização de Propriedades
1. **Acesse** "Configurações do projeto"
2. **Edite** as propriedades necessárias
3. **Salve**

## 🛠️ Troubleshooting

### ❌ Erro: "Acesso negado"
**Solução**: Verificar se:
- Você é proprietário da planilha
- SHEET_ID está correto nas propriedades
- Reautorizar permissões se necessário

### ❌ Erro: "Função não encontrada"
**Solução**: 
- Verificar se salvou todos os arquivos
- Executar função `setupInicial` novamente
- Limpar cache do navegador

### ❌ Interface não carrega
**Solução**:
- Verificar se o arquivo `index.html` existe
- Testar em navegador privado/incógnito
- Verificar console do navegador (F12)

### ❌ Emails não chegam
**Solução**:
- Verificar EMAIL_PADRAO nas propriedades
- Verificar pasta de spam
- Testar executar `verificarVencimentosDiarios` manualmente

### ❌ Planilha não atualiza
**Solução**:
- Verificar permissões da planilha
- Executar `setupInicial` novamente
- Verificar se SHEET_ID está correto

## 📊 Estrutura Final dos Arquivos

```
📁 Controle Financeiro PJ (Apps Script)
├── 📄 Code.gs (Backend principal)
├── 📄 index.html (Frontend/Interface)
├── 📄 sw.js (Service Worker - opcional)
├── 📄 manifest.json (PWA Manifest - opcional)
└── ⚙️ Propriedades:
    ├── SHEET_ID
    ├── EMAIL_PADRAO  
    ├── PASTA_DRIVE_ID (opcional)
    └── WEBHOOK_URL (opcional)
```

```
📁 Google Drive
├── 📊 Controle Financeiro PJ.xlsx (Planilha principal)
└── 📁 Comprovantes Financeiro PJ/ (opcional)
    └── 📎 uploads de comprovantes...
```

## 🔒 Segurança e Backup

### Backup Automático
- ✅ Planilha sincronizada automaticamente no Drive
- ✅ Histórico de versões do Google Sheets
- ✅ Logs de auditoria na aba "Log"

### Controle de Acesso
- ✅ Apenas proprietário pode acessar
- ✅ OAuth do Google para autenticação
- ✅ Validação de dados no backend

### Recomendações
1. **Faça backup** da planilha mensalmente
2. **Mantenha** logs por no máximo 12 meses
3. **Monitore** a aba "Erros" regularmente
4. **Teste** as funcionalidades após atualizações

## 📈 Próximos Passos

### Após Deploy
1. ✅ **Importar** dados históricos (se houver)
2. ✅ **Configurar** categorias personalizadas
3. ✅ **Criar** agendas recorrentes
4. ✅ **Testar** workflow completo
5. ✅ **Treinar** usuário final

### Melhorias Futuras
- [ ] Relatórios PDF automáticos
- [ ] Integração bancária
- [ ] Categorização com IA
- [ ] Dashboard com gráficos
- [ ] Controle orçamentário

## 🆘 Suporte

### Links Úteis
- [Documentação Google Apps Script](https://developers.google.com/apps-script)
- [Referência Sheets API](https://developers.google.com/sheets/api)
- [Comunidade Apps Script](https://stackoverflow.com/questions/tagged/google-apps-script)

### Logs para Debug
1. **Apps Script**: Menu "Execuções" mostra logs e erros
2. **Planilha**: Aba "Erros" registra erros em tempo real
3. **Navegador**: Console do desenvolvedor (F12)

---

**✅ Sistema pronto para uso!**

Após seguir todos os passos, você terá um sistema completo de controle financeiro funcionando 24/7 na nuvem do Google, acessível de qualquer dispositivo com internet.