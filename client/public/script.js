// Variáveis globais
let isSeeking = false;
let isActionFromNetwork = false;
let player, webSocket, uiUpdater;

// Referências aos elementos da UI
const hostBtn = document.getElementById("host-btn");
const guestBtn = document.getElementById("guest-btn");
const appContent = document.getElementById("app-content");
const loadControls = document.getElementById("load-controls");
const welcomeScreen = document.getElementById("welcome-screen");

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

// Inicialização do Player do YouTube
function onYouTubeIframeAPIReady() {
  player = new YT.Player("player", {
    height: "100%",
    width: "100%",
    videoId: "",
    playerVars: {
      controls: 0,
      rel: 0,
      showinfo: 0,
      modestbranding: 1,
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
    },
  });
}

hostBtn.addEventListener("click", async () => {
  // Mostra a tela principal e esconde a de boas-vindas
  welcomeScreen.classList.add("hidden");
  appContent.classList.remove("hidden");
  document.body.classList.remove("justify-center"); // Remove a centralização vertical

  // Inicia o player e o WebSocket para o host (usando o IP padrão do servidor)
  onYouTubeIframeAPIReady();
  connectWebSocket();
});

// Botão para ser GUEST
guestBtn.addEventListener("click", () => {
  // Mostra a tela principal e esconde a de boas-vindas
  welcomeScreen.classList.add("hidden");
  appContent.classList.remove("hidden");
  loadControls.classList.add("hidden");
  document.body.classList.remove("justify-center");

  // Inicia o player e o WebSocket para o guest
  onYouTubeIframeAPIReady();
  connectWebSocket();
});

// Lógica do Player e WebSocket
function onPlayerReady() {
  statusElement.textContent = "Player pronto. A ligar ao servidor...";
  setupUIEventListeners();
}

function onPlayerStateChange(event) {
  updatePlayPauseButton(event.data);
  if (isActionFromNetwork || isSeeking) {
    return;
  }

  let commandType = null;
  switch (event.data) {
    case YT.PlayerState.PLAYING:
      commandType = "PLAY";
      break;
    case YT.PlayerState.PAUSED:
      commandType = "PAUSE";
      break;
  }
  if (commandType) {
    sendCommand({
      type: commandType,
      videoId: player.getVideoData().video_id,
      currentTime: player.getCurrentTime(),
    });
  }
}

// Conexão WebSocket
function connectWebSocket() {
  const hostIP = "127.0.0.1:8080"; // Trocar para IP da máquina que está hosteando
  const wsUrl = `ws://${hostIP}/watchparty`;
  webSocket = new WebSocket(wsUrl);
  webSocket.onopen = () =>
    (statusElement.textContent = "Ligado ao servidor de Watch Party!");
  webSocket.onmessage = (event) => handleServerCommand(JSON.parse(event.data));
  webSocket.onclose = () => {
    statusElement.textContent =
      "Desligado. A tentar ligar novamente em 5 segundos...";
    setTimeout(() => connectWebSocket(), 5000);
  };
  webSocket.onerror = () =>
    (statusElement.textContent =
      "Erro de ligação. Verifique se o servidor está a correr.");
}

// Manipulação de Comandos
function handleServerCommand(command) {
  if (!player || typeof player.getPlayerState !== "function") return;
  isActionFromNetwork = true;

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
  setTimeout(() => {
    isActionFromNetwork = false;
  }, 100);
}

function handleVideoCommand(command) {
  const currentVideoIdOnPlayer = player.getVideoData()?.video_id;
  if (command.videoId && command.videoId !== currentVideoIdOnPlayer) {
    player.loadVideoById(command.videoId, command.currentTime);
  }
  if (command.type === "PLAY") {
    player.seekTo(command.currentTime, true);
    player.playVideo();
  } else if (command.type === "PAUSE") {
    player.pauseVideo();
    player.seekTo(command.currentTime, true);
  } else if (command.type === "SEEK" || command.type === "LOAD") {
    player.seekTo(command.currentTime, true);
  }
}

function sendCommand(command) {
  if (webSocket && webSocket.readyState === WebSocket.OPEN) {
    webSocket.send(JSON.stringify(command));
  } else {
    statusElement.textContent = "Erro: Sem ligação ao servidor.";
  }
}

// Lógica da UI e Eventos
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
    state === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
  });

  seekSlider.addEventListener("input", () => {
    isSeeking = true;
  });

  seekSlider.addEventListener("change", () => {
    const seekTime = parseFloat(seekSlider.value);
    isActionFromNetwork = true;
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

  sendChatBtn.addEventListener("click", sendChatMessage);
  chatMessageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChatMessage();
  });
}

// Funções Utilitárias
function sendChatMessage() {
  const sender = usernameInput.value.trim();
  const message = chatMessageInput.value.trim();
  if (!sender || !message) {
    alert("Preencha o seu nome e uma mensagem.");
    return;
  }
  sendCommand({ type: "CHAT", sender: sender, message: message });
  displayChatMessage(sender, message, true); // Mostra a mensagem localmente
  chatMessageInput.value = "";
}

function displayChatMessage(sender, message, isLocalSender = false) {
  const p = document.createElement("p");
  p.classList.add("break-words", "mb-2");

  const strong = document.createElement("strong");
  strong.textContent = `${sender}: `;
  strong.classList.add(isLocalSender ? "text-secondary" : "text-primary");

  p.appendChild(strong);
  p.appendChild(document.createTextNode(message));

  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function startUIUpdater() {
  if (uiUpdater) clearInterval(uiUpdater);
  uiUpdater = setInterval(() => {
    if (player && typeof player.getCurrentTime === "function" && !isSeeking) {
      const currentTime = player.getCurrentTime();
      const duration = player.getDuration();
      seekSlider.max = duration || 0;
      seekSlider.value = currentTime;
      timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(
        duration
      )}`;
    }
  }, 250);
}

function updatePlayPauseButton(playerState) {
  if (playerState === YT.PlayerState.PLAYING) {
    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
    startUIUpdater();
  } else {
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
  }
}

function formatTime(seconds) {
  const date = new Date(0);
  date.setSeconds(seconds || 0);
  return date.toISOString().slice(14, 19);
}

function extractVideoID(url) {
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}
