# Controle Financeiro PJ - Guia de Implementação

## 📋 Visão Geral

Sistema completo de controle financeiro para pessoa jurídica usando Google Apps Script como backend e Google Sheets como banco de dados, com frontend mobile-first responsivo.

## 🚀 Setup Inicial

### 1. Criar o Projeto no Google Apps Script

1. Acesse [script.google.com](https://script.google.com)
2. Clique em "Novo projeto"
3. Renomeie para "Controle Financeiro PJ"

### 2. Configurar o Backend

1. Cole o código do backend no arquivo `Code.gs`
2. Crie um novo arquivo HTML chamado `index` e cole o frontend
3. Execute a função `setupInicial()` uma vez para:
   - Criar a planilha modelo
   - Configurar os triggers
   - Definir estruturas iniciais

### 3. Configurar Propriedades do Script

Vá em **Configurações** > **Propriedades do script** e adicione:

```
SHEET_ID = [ID da planilha criada]
PASTA_DRIVE_ID = [ID da pasta do Drive para comprovantes]
EMAIL_PADRAO = seu@email.com
WEBHOOK_URL = [URL do webhook para notificações - opcional]
```

### 4. Implantar como Web App

1. Clique em **Implantar** > **Nova implantação**
2. Tipo: **Aplicativo da web**
3. Executar como: **Eu**
4. Quem tem acesso: **Somente eu**
5. Clique em **Implantar**
6. Copie a URL do Web App

### 5. Configurar Permissões

O script precisará das seguintes permissões:
- Google Sheets (leitura/escrita)
- Google Drive (upload de arquivos)
- Gmail (envio de notificações)
- Triggers baseados em tempo

## 📊 Estrutura da Planilha

### Abas Principais

#### Transacoes
- **id**: UUID único da transação
- **data**: Data da transação
- **tipo**: Entrada | Saída | Transferência | Reserva | Estorno
- **categoria**: Categoria da transação (ref. aba Categorias)
- **descricao**: Descrição da transação
- **valor**: Valor em reais
- **forma_pagto**: Pix | Cartão | Boleto | Dinheiro | TED | Outros
- **status**: Pendente | Pago | Cancelado
- **vinculo_agenda_id**: ID da agenda vinculada (opcional)
- **comprovante_url**: URL do comprovante no Drive
- **criado_em**: Timestamp de criação
- **atualizado_em**: Timestamp de atualização

#### Agendas
- **agenda_id**: UUID único da agenda
- **tipo**: Pagar | Receber
- **descricao**: Descrição do agendamento
- **valor_previsto**: Valor esperado
- **data_vencimento**: Data de vencimento
- **recorrencia**: Nenhuma | Semanal | Mensal | Anual
- **status**: Aberta | Programada | Paga | Atrasada | Cancelada
- **notificar_em**: Dias antes para notificar (ex: 7;3;1)
- **responsavel_email**: Email para notificações
- **criado_em**: Timestamp de criação
- **atualizado_em**: Timestamp de atualização

#### Reservas
- **reserva_id**: UUID único da reserva
- **descricao**: Descrição da reserva
- **categoria**: Categoria da reserva
- **valor_reservado**: Valor inicial reservado
- **data_reserva**: Data da criação da reserva
- **saldo_reserva**: Saldo atual da reserva

#### Categorias
- **categoria**: Nome da categoria
- **tipo_padrao**: Entrada | Saída | Transferência
- **centro_custo**: Centro de custo (opcional)
- **ativo**: TRUE/FALSE

#### Dashboard
Fórmulas para KPIs automáticos:
- Total de entradas
- Total de impostos + contador
- Total pró-labore
- Total despesas
- Saldo líquido

#### Formatacao_Replica
Espelha o layout da planilha original com:
- Colunas para cada mês (JAN-DEZ)
- Seções coloridas por categoria
- Fórmulas SUMIFS para totalizações automáticas

### Abas de Sistema
- **Log**: Auditoria de todas as operações
- **Erros**: Log de erros do sistema
- **Parametros**: Configurações gerais

## 🔧 Endpoints da API

### GET Endpoints
- `GET /api/dashboard` - KPIs e resumo geral
- `GET /api/mes/2024-01` - Dados de um mês específico
- `GET /api/transacoes` - Lista de transações (com filtros)
- `GET /api/agendas` - Lista de agendas
- `GET /api/reservas` - Lista de reservas
- `GET /api/categorias` - Lista de categorias ativas

### POST Endpoints
- `POST /api/transacoes` - Criar nova transação
- `POST /api/agendas` - Criar nova agenda
- `POST /api/reservas` - Criar nova reserva
- `POST /api/transacoes/{id}/patch` - Atualizar transação
- `POST /api/agendas/{id}/pagar` - Marcar agenda como paga
- `POST /api/reservas/{id}/movimentar` - Movimentar reserva

## 📱 Funcionalidades do Frontend

### Telas Principais
1. **Home**: Dashboard com KPIs e vencimentos próximos
2. **Transações**: Lista filtrada de todas as transações
3. **Agendas**: Gerenciamento de contas a pagar/receber
4. **Reservas**: Controle de valores reservados
5. **Planilha**: Visualização do layout consolidado

### Recursos Implementados
- ✅ Interface mobile-first responsiva
- ✅ Navegação por tabs inferior
- ✅ Modais para criação de registros
- ✅ Filtros e busca em transações
- ✅ Upload de comprovantes (preparado)
- ✅ Notificações visuais
- ✅ Cache local para performance
- ✅ Modo offline básico
- ✅ PWA ready (manifest + service worker)
- ✅ Atalhos de teclado
- ✅ Validação de formulários

## 🔔 Sistema de Notificações

### Trigger Diário
Configurado para executar diariamente e:
1. Marcar agendas atrasadas
2. Enviar email com resumo do dia
3. Opcional: enviar para webhook configurado

### Email Template
- Próximos vencimentos (7 dias)
- Itens em atraso
- Links diretos para o webapp

## 🛡️ Segurança

### Medidas Implementadas
- Autenticação OAuth do Google (proprietário apenas)
- Validação de dados no backend
- Logs de auditoria completos
- Proteção de abas críticas da planilha
- Escopo mínimo de permissões

### Boas Práticas
- Nunca expor IDs de planilha no frontend
- Validar todos os inputs
- Manter logs de todas as operações
- Backup automático via Google Drive

## 🎨 Design System

### Cores Principais
- Primary: `#4F46E5` (Indigo)
- Success: `#10B981` (Green)
- Warning: `#F59E0B` (Amber)
- Danger: `#EF4444` (Red)
- Gray Scale: `#F9FAFB` a `#111827`

### Componentes
- Cards com sombra sutil
- Botões com estados hover
- Modais bottom-sheet mobile
- Badge system para status
- Grid responsivo 8px

## 📈 Performance

### Otimizações Implementadas
- Cache de 5 minutos para dashboard
- Lazy loading para listas grandes
- Batch operations no Sheets
- Paginação de resultados
- Minificação de responses

### Monitoramento
- Console logs para debugging
- Analytics simples integrado
- Métricas de performance básicas

## 🔄 Manutenção

### Atualizações de Versão
1. Atualizar `APP_CONFIG.VERSION` no frontend
2. Executar nova implantação do Apps Script
3. Cache será limpo automaticamente

### Backup e Recuperação
- Planilha automaticamente sincronizada no Drive
- Logs preservados por tempo indefinido
- Export de dados via API disponível

### Troubleshooting Comum

**Erro de permissões:**
- Verificar se o usuário é proprietário da planilha
- Reautorizar o script se necessário

**Performance lenta:**
- Verificar cache do navegador
- Limpar dados antigos das abas de log
- Otimizar fórmulas da planilha

**Notificações não funcionam:**
- Verificar trigger configurado
- Confirmar EMAIL_PADRAO nas propriedades
- Testar função manualmente

## 🚀 Roadmap de Melhorias

### Fase 2 (Opcionais)
- [ ] Importação de CSV bancário
- [ ] OCR para notas fiscais
- [ ] Categorias orçamentárias com limites
- [ ] Relatórios PDF automáticos
- [ ] Integração com WhatsApp/Telegram
- [ ] Tags por projeto/cliente
- [ ] Dashboard com gráficos avançados

### Fase 3 (Futuro)
- [ ] Aplicativo móvel nativo
- [ ] Integração com Open Banking
- [ ] IA para categorização automática
- [ ] Multi-empresas
- [ ] API pública para integrações

## 📞 Suporte

Para dúvidas técnicas:
1. Verificar logs de erro na planilha
2. Testar funções individuais no Apps Script
3. Consultar documentação do Google Apps Script
4. Revisar permissões e configurações

---

**Versão:** 1.0.0  
**Última atualização:** Agosto 2025  
**Compatibilidade:** Google Apps Script, navegadores modernos