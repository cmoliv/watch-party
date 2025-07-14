// =================================================================
// SEÇÃO 1: VARIÁVEIS GLOBAIS E REFERÊNCIAS À UI
// =================================================================

// --- Variáveis de Estado ---
// Estas variáveis ajudam a controlar o comportamento da aplicação.

// 'isSeeking' é usada para saber se o utilizador está a arrastar a barra de progresso.
// Isto evita que a barra seja atualizada automaticamente enquanto o utilizador a manipula.
let isSeeking = false;

// 'isActionFromNetwork' é uma flag crucial para evitar "loops infinitos".
// Quando o cliente recebe um comando do servidor (ex: PLAY), ele executa a ação.
// Essa ação (dar play) iria disparar um evento local, que enviaria o mesmo comando de volta ao servidor.
// Esta flag diz ao código: "Esta ação veio da rede, não a reenvie."
let isActionFromNetwork = false;

// Variáveis que irão guardar as instâncias principais da nossa aplicação.
let player, webSocket, uiUpdater;

// --- Referências aos Elementos da UI (DOM) ---
// Guardamos os elementos HTML em variáveis para aceder a eles de forma mais rápida e fácil no código.

// Ecrã de boas-vindas e conteúdo principal
const hostBtn = document.getElementById("host-btn");
const guestBtn = document.getElementById("guest-btn");
const appContent = document.getElementById("app-content");
const loadControls = document.getElementById("load-controls");
const welcomeScreen = document.getElementById("welcome-screen");

// Elementos do player e do chat
const chatLog = document.getElementById("chat-log");
const playIcon = document.getElementById("play-icon");
const statusElement = document.getElementById("status");
const pauseIcon = document.getElementById("pause-icon");
const seekSlider = document.getElementById("seek-slider");
const timeDisplay = document.getElementById("time-display");
const sendChatBtn = document.getElementById("send-chat-btn");
const youtubeUrlInput = document.getElementById("youtubeUrl");
const playPauseBtn = document.getElementById("play-pause-btn");
const usernameInput = document.getElementById("username-input");
const loadVideoButton = document.getElementById("loadVideoButton");
const chatMessageInput = document.getElementById("chat-message-input");

// =================================================================
// SEÇÃO 2: INICIALIZAÇÃO DA APLICAÇÃO
// =================================================================

/**
 * Função especial chamada automaticamente pela API do YouTube quando ela termina de carregar.
 * A sua responsabilidade é criar o player de vídeo dentro do <div> com id="player".
 */
function onYouTubeIframeAPIReady() {
  player = new YT.Player("player", {
    height: "100%",
    width: "100%",
    videoId: "", // Começa sem nenhum vídeo carregado.
    playerVars: {
      controls: 0, // 0 = esconde os controlos nativos do YouTube.
      rel: 0, // Não mostra vídeos relacionados no final.
      showinfo: 0, // Não mostra o título do vídeo.
      modestbranding: 1, // Remove o logo do YouTube dos controlos.
    },
    // Define quais funções serão chamadas em resposta a eventos do player.
    events: {
      onReady: onPlayerReady, // Chamada quando o player está pronto.
      onStateChange: onPlayerStateChange, // Chamada quando o vídeo dá play, pausa, etc.
    },
  });
}

/**
 * Event listener para o botão "Ser Host".
 * Inicia a aplicação no modo de anfitrião.
 */
hostBtn.addEventListener("click", async () => {
  // Esconde o ecrã de boas-vindas e mostra o conteúdo principal da aplicação.
  welcomeScreen.classList.add("hidden");
  appContent.classList.remove("hidden");
  document.body.classList.remove("justify-center"); // Ajuste de estilo.

  // Inicia o player do YouTube e a ligação com o servidor.
  onYouTubeIframeAPIReady();
  connectWebSocket();
});

/**
 * Event listener para o botão "Ser Convidado".
 * Inicia a aplicação no modo de convidado, escondendo os controlos de host.
 */
guestBtn.addEventListener("click", () => {
  welcomeScreen.classList.add("hidden");
  appContent.classList.remove("hidden");
  loadControls.classList.add("hidden"); // Esconde os controlos de carregar vídeo.
  document.body.classList.remove("justify-center");

  onYouTubeIframeAPIReady();
  connectWebSocket();
});

// =================================================================
// SEÇÃO 3: LÓGICA DO PLAYER E WEBSOCKET
// =================================================================

/**
 * Chamada quando o player do YouTube está totalmente carregado e pronto para ser controlado.
 * É o ponto de partida para ligar os nossos botões e controlos ao player.
 */
function onPlayerReady() {
  statusElement.textContent = "Player pronto. A ligar ao servidor...";
  setupUIEventListeners(); // Configura todos os event listeners dos nossos botões.
}

/**
 * Chamada sempre que o estado do player muda (ex: de pausado para a tocar).
 * Esta função é a chave para a sincronização iniciada pelo host.
 * @param {object} event - O objeto de evento da API do YouTube.
 */
function onPlayerStateChange(event) {
  updatePlayPauseButton(event.data); // Atualiza o ícone do nosso botão de play/pause.

  // Se a ação veio da rede ou se o utilizador está a arrastar o slider, não faz nada.
  if (isActionFromNetwork || isSeeking) {
    return;
  }

  // Converte o estado do player (ex: YT.PlayerState.PLAYING) para o nosso tipo de comando.
  let commandType = null;
  switch (event.data) {
    case YT.PlayerState.PLAYING:
      commandType = "PLAY";
      break;
    case YT.PlayerState.PAUSED:
      commandType = "PAUSE";
      break;
  }

  // Se for um comando válido (play ou pause), envia-o para o servidor.
  if (commandType) {
    sendCommand({
      type: commandType,
      videoId: player.getVideoData().video_id,
      currentTime: player.getCurrentTime(),
    });
  }
}

/**
 * Inicia a conexão com o servidor WebSocket.
 */
function connectWebSocket() {
  // IMPORTANTE: Este IP deve ser o da máquina que está a correr o servidor Java.
  // Para testes locais na mesma máquina, 'localhost' ou '127.0.0.1' funcionam.
  // Para testes em rede, use o IP da rede local do servidor (ex: '192.168.1.10').
  const hostIP = "127.0.0.1:8080";
  const wsUrl = `ws://${hostIP}/watchparty`;

  webSocket = new WebSocket(wsUrl);

  // Define o que acontece em cada evento da conexão WebSocket.
  webSocket.onopen = () => (statusElement.textContent = "Ligado ao servidor de Watch Party!");
  webSocket.onmessage = (event) => handleServerCommand(JSON.parse(event.data)); // A ação principal acontece aqui.
  webSocket.onclose = () => {
    statusElement.textContent = "Desligado. A tentar ligar novamente em 5 segundos...";
    setTimeout(() => connectWebSocket(), 5000); // Tenta reconectar automaticamente.
  };
  webSocket.onerror = () => (statusElement.textContent = "Erro de ligação. Verifique se o servidor está a correr.");
}

// =================================================================
// SEÇÃO 4: MANIPULAÇÃO DE COMANDOS
// =================================================================

/**
 * O "cérebro" do cliente. Recebe todos os comandos do servidor e decide o que fazer.
 * @param {object} command - O objeto de comando recebido do servidor.
 */
function handleServerCommand(command) {
  if (!player || typeof player.getPlayerState !== "function") return;
  isActionFromNetwork = true; // Ativa a flag para não reenviar o comando.

  // Delega a ação para a função correta com base no tipo de comando.
  switch (command.type) {
    case "LOAD":
    case "SEEK":
    case "PLAY":
    case "PAUSE":
      handleVideoCommand(command);
      break;
    case "CHAT":
      displayChatMessage(command.sender, command.message, false);
      break;
  }

  // Desativa a flag após um curto período, para que as ações locais voltem a funcionar.
  setTimeout(() => {
    isActionFromNetwork = false;
  }, 100);
}

/**
 * Processa todos os comandos relacionados ao vídeo.
 * @param {object} command - O comando de vídeo a ser executado.
 */
function handleVideoCommand(command) {
  const currentVideoIdOnPlayer = player.getVideoData()?.video_id;

  // Se o comando é para um vídeo diferente do que está carregado, carrega o novo vídeo.
  if (command.videoId && command.videoId !== currentVideoIdOnPlayer) {
    player.loadVideoById(command.videoId, command.currentTime);
  }

  // Executa a ação específica do comando.
  if (command.type === "PLAY") {
    player.seekTo(command.currentTime, true); // Garante que o tempo está sincronizado.
    player.playVideo();
  } else if (command.type === "PAUSE") {
    player.pauseVideo();
    player.seekTo(command.currentTime, true);
  } else if (command.type === "SEEK" || command.type === "LOAD") {
    player.seekTo(command.currentTime, true);
  }
}

/**
 * Função central para enviar qualquer comando para o servidor.
 * @param {object} command - O objeto de comando a ser enviado.
 */
function sendCommand(command) {
  if (webSocket && webSocket.readyState === WebSocket.OPEN) {
    webSocket.send(JSON.stringify(command)); // Converte o objeto para uma string JSON e envia.
  } else {
    statusElement.textContent = "Erro: Sem ligação ao servidor.";
  }
}

// =================================================================
// SEÇÃO 5: LÓGICA DA UI E EVENT LISTENERS
// =================================================================

/**
 * Configura todos os "ouvintes" de eventos para os nossos elementos de UI.
 * É isto que torna os botões e sliders interativos.
 */
function setupUIEventListeners() {
  loadVideoButton.addEventListener("click", () => {
    const videoId = extractVideoID(youtubeUrlInput.value.trim());
    if (videoId) {
      sendCommand({ type: "LOAD", videoId: videoId, currentTime: 0 });
      youtubeUrlInput.value = "";
    } else {
      alert("URL do YouTube inválida!");
    }
  });

  playPauseBtn.addEventListener("click", () => {
    const state = player.getPlayerState();
    // Alterna entre play e pause. A ação de enviar o comando é tratada no 'onPlayerStateChange'.
    state === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
  });

  // Quando o utilizador começa a arrastar o slider.
  seekSlider.addEventListener("input", () => {
    isSeeking = true;
  });

  // Quando o utilizador solta o slider.
  seekSlider.addEventListener("change", () => {
    const seekTime = parseFloat(seekSlider.value);
    isActionFromNetwork = true; // Previne o envio de um evento PAUSE indesejado.
    player.seekTo(seekTime, true);
    sendCommand({
      type: "SEEK",
      videoId: player.getVideoData().video_id,
      currentTime: seekTime,
    });
    isSeeking = false;
    setTimeout(() => {
      isActionFromNetwork = false;
    }, 100);
  });

  // Listeners para o chat.
  sendChatBtn.addEventListener("click", sendChatMessage);
  chatMessageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChatMessage();
  });
}

// =================================================================
// SEÇÃO 6: FUNÇÕES UTILITÁRIAS
// =================================================================

/**
 * Constrói e envia uma mensagem de chat para o servidor.
 */
function sendChatMessage() {
  const sender = usernameInput.value.trim();
  const message = chatMessageInput.value.trim();
  if (!sender || !message) {
    alert("Preencha o seu nome e uma mensagem.");
    return;
  }
  sendCommand({ type: "CHAT", sender: sender, message: message });
  displayChatMessage(sender, message, true); // Mostra a própria mensagem imediatamente.
  chatMessageInput.value = "";
}

/**
 * Adiciona uma mensagem de chat ao log visual.
 * @param {string} sender - Quem enviou a mensagem.
 * @param {string} message - O conteúdo da mensagem.
 * @param {boolean} isLocalSender - Se verdadeiro, aplica um estilo diferente para a mensagem do próprio utilizador.
 */
function displayChatMessage(sender, message, isLocalSender = false) {
  const p = document.createElement("p");
  p.classList.add("break-words", "mb-2");

  const strong = document.createElement("strong");
  strong.textContent = `${sender}: `;
  strong.classList.add(isLocalSender ? "text-secondary" : "text-primary");

  p.appendChild(strong);
  p.appendChild(document.createTextNode(message));

  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight; // Rola o chat para baixo automaticamente.
}

/**
 * Inicia um loop que atualiza a nossa barra de progresso e o tempo do vídeo.
 */
function startUIUpdater() {
  if (uiUpdater) clearInterval(uiUpdater); // Limpa qualquer atualizador antigo.
  uiUpdater = setInterval(() => {
    if (player && typeof player.getCurrentTime === "function" && !isSeeking) {
      const currentTime = player.getCurrentTime();
      const duration = player.getDuration();
      seekSlider.max = duration || 0;
      seekSlider.value = currentTime;
      timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    }
  }, 250); // Atualiza 4 vezes por segundo.
}

/**
 * Altera o ícone do botão de play/pause.
 * @param {number} playerState - O estado atual do player (ex: 1 para PLAYING, 2 para PAUSED).
 */
function updatePlayPauseButton(playerState) {
  if (playerState === YT.PlayerState.PLAYING) {
    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
    startUIUpdater(); // Inicia as atualizações da UI quando o vídeo começa.
  } else {
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
  }
}

/**
 * Formata segundos para o formato "mm:ss".
 * @param {number} seconds - O tempo em segundos.
 * @returns {string} O tempo formatado.
 */
function formatTime(seconds) {
  const date = new Date(0);
  date.setSeconds(seconds || 0);
  return date.toISOString().slice(14, 19);
}

/**
 * Extrai o ID do vídeo de uma URL do YouTube.
 * @param {string} url - A URL completa do YouTube.
 * @returns {string|null} O ID do vídeo ou nulo se não for encontrado.
 */
function extractVideoID(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}
