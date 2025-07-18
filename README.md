# YouTube Watch Party

## 1. Visão Geral

O **YouTube Watch Party** é uma aplicação cliente-servidor que permite a múltiplos usuários assistirem a vídeos do YouTube de forma sincronizada e em tempo real. A aplicação possui a figura de um "host", que controla a reprodução do vídeo (carregar, iniciar, pausar, avançar/retroceder), e as ações do host são replicadas instantaneamente para todos os outros participantes da sessão.

Além da sincronização de vídeo, a aplicação também conta com um chat em tempo real, para que os usuários possam interagir enquanto assistem ao vídeo.

## 2. Arquitetura

A aplicação é dividida em duas partes principais:

- **Cliente**: Uma aplicação web (HTML, CSS, JavaScript) que roda no navegador do usuário. É responsável por exibir o player de vídeo do YouTube, os controles de reprodução e a interface de chat.
- **Servidor**: Uma aplicação Java com Spring Boot que gerencia a comunicação entre os clientes. O servidor utiliza WebSockets para garantir a comunicação em tempo real e a sincronização de todos os participantes.

### 2.1. Protocolo de Transporte

O protocolo de transporte escolhido foi o **TCP (Transmission Control Protocol)**, implementado através da abstração **WebSockets**. A escolha pelo TCP se deu pela necessidade de **confiabilidade** e **ordenação** das mensagens. Ações como `PLAY`, `PAUSE` e `SEEK` são críticas e não podem ser perdidas, o que torna o UDP uma opção inviável.

Os WebSockets estabelecem um canal de comunicação bidirecional (full-duplex) persistente entre o cliente e o servidor, reduzindo a latência e o overhead que seriam gerados ao abrir e fechar conexões TCP para cada comando.

### 2.2. Protocolo da Camada de Aplicação

A comunicação entre cliente e servidor é feita através de mensagens no formato **JSON**. Cada mensagem possui um campo `type` que define a natureza do comando.

As seguintes mensagens são suportadas:

| Tipo de Mensagem (type) | Direção                       | Campos do Payload                          | Descrição da Ação                                                                                                                                         |
| ----------------------- | ----------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LOAD`                  | Cliente → Servidor → Clientes | `videoId` (String), `currentTime` (Double) | Inicia o carregamento de um novo vídeo. O cliente host envia, o servidor faz broadcast, e todos os clientes carregam o vídeo especificado pelo `videoId`. |
| `PLAY`                  | Cliente → Servidor → Clientes | `videoId` (String), `currentTime` (Double) | Inicia ou retoma a reprodução do vídeo a partir do `currentTime` especificado, garantindo a sincronia de início.                                          |
| `PAUSE`                 | Cliente → Servidor → Clientes | `videoId` (String), `currentTime` (Double) | Pausa a reprodução do vídeo. O `currentTime` é enviado para garantir que todos parem no mesmo ponto.                                                      |
| `SEEK`                  | Cliente → Servidor → Clientes | `videoId` (String), `currentTime` (Double) | Move a reprodução para um ponto específico do vídeo, definido pelo `currentTime`.                                                                         |
| `CHAT`                  | Cliente → Servidor → Clientes | `sender` (String), `message` (String)      | Envia uma mensagem de texto no chat. O `sender` é o nome do utilizador e `message` é o conteúdo.                                                          |

## 3. Como Executar

### 3.1. Pré-requisitos

#### Servidor

- **Java Development Kit (JDK)**: Versão 17 ou superior.
- **Apache Maven**: Versão 3.6 ou superior.

#### Cliente

- Um navegador web moderno com suporte a JavaScript e WebSockets (ex: Google Chrome, Mozilla Firefox, Microsoft Edge).
- Uma conexão de internet ativa.

### 3.2. Executando o Servidor

1.  Navegue até o diretório `server`:
    ```bash
    cd server
    ```
2.  Compile o projeto com o Maven:
    ```bash
    mvn clean install
    ```
3.  Execute a aplicação:
    `bash
    mvn spring-boot:run
    `
    O servidor estará rodando em `http://localhost:8080`.

### 3.3. Executando o Cliente

1.  Abra o arquivo `client/public/index.html` em seu navegador.
2.  Para iniciar uma sessão como **host**, clique no botão "Ser o Host".
3.  Para entrar em uma sessão como **convidado**, clique no botão "Entrar como Convidado".

## 4. Detalhes da Implementação

### 4.1. Cliente

- **`index.html`**: Estrutura principal da página, com os elementos da interface do usuário.
- **`style.css`**: Estilização da página, utilizando o framework Tailwind CSS.
- **`script.js`**: Lógica do cliente, incluindo:
  - Inicialização do player de vídeo do YouTube.
  - Conexão com o servidor via WebSocket.
  - Manipulação de eventos da interface do usuário (botões, slider de busca, etc.).
  - Envio e recebimento de comandos do servidor.
  - Lógica do chat.

### 4.2. Servidor

- **`WatchpartyApplication.java`**: Classe principal da aplicação Spring Boot.
- **`WebSocketConfig.java`**: Configuração do WebSocket, registrando o handler no endpoint `/watchparty`.
- **`WatchPartyWebSocketHandler.java`**: Handler principal do WebSocket, responsável por:
  - Gerenciar as sessões dos clientes conectados.
  - Receber mensagens dos clientes, deserializá-las e identificar o tipo de comando.
  - Fazer o "broadcast" das mensagens para todos os clientes conectados.
  - Armazenar o último estado do vídeo para sincronizar novos clientes.
- **`VideoCommand.java`**: Modelo de dados que representa os comandos trocados entre cliente e servidor.
