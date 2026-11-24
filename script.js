const DB_NAME = "StillAlbumDB";
const STORE_NAME = "memories";

let memories = [];
// Album viewer state
let currentAlbum = [];
let currentIndex = 0;

// Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Save a memory
async function saveMemory(memory) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).add(memory);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Get all memories
async function getMemories() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Delete memory
async function deleteMemory(id) {
  
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}


async function deleteAlbum(date, albumTitle) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const allMemories = request.result;

      allMemories.forEach(memory => {
        const title = memory.albumTitle || "Untitled Album";

        if (
          memory.date === date &&
          title === albumTitle
        ) {
          store.delete(memory.id);
        }
      });
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}


// Format date
function formatDate(date) {
  const d = new Date(date + "T00:00:00");

  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

// Get today's date
function getToday() {
  return new Date().toISOString().split("T")[0];
}

// Create image/video element
function createMediaElement(memory) {
  const url = URL.createObjectURL(memory.file);
  let element;

  if (memory.file.type.startsWith("video/")) {
    element = document.createElement("video");
    element.src = url;
    element.controls = true;
  } else {
    element = document.createElement("img");
    element.src = url;
    element.alt = memory.caption || "Memory";
  }

  return element;
}

// Create memory card
function createMemoryCard(memory) {
  const card = document.createElement("div");
  card.className = "memory-card";

  card.appendChild(createMediaElement(memory));

  const info = document.createElement("div");
  info.className = "memory-info";

  const title = document.createElement("h3");
  title.textContent = memory.caption || "A little memory";

  const date = document.createElement("p");
  date.textContent = formatDate(memory.date);

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  deleteBtn.style.marginTop = "10px";
  deleteBtn.style.border = "none";
  deleteBtn.style.background = "none";
  deleteBtn.style.color = "#8a8d84";
  deleteBtn.style.cursor = "pointer";

  deleteBtn.onclick = async () => {
    if (confirm("Delete this memory?")) {
      await deleteMemory(memory.id);
      await render();
    }
  };

  info.append(title, date, deleteBtn);
  card.appendChild(info);

  return card;
}

// Group memories by date

function groupByDate(items) {
  const groups = {};

  items.forEach(memory => {
    if (!groups[memory.date]) {
      groups[memory.date] = [];
    }

    groups[memory.date].push(memory);
  });

  return groups;
}

// Group memories into albums using date + album title
function groupByAlbum(items) {
  const groups = {};

  items.forEach(memory => {
    const title = memory.albumTitle || "Untitled Album";
    const key = `${memory.date}__${title}`;

    if (!groups[key]) {
      groups[key] = {
        date: memory.date,
        title: title,
        items: []
      };
    }

    groups[key].items.push(memory);
  });

  return groups;
}


// Render recent memories
function renderRecent() {
  const container = document.getElementById("recentMemories");
  container.innerHTML = "";

  const recent = [...memories]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  if (recent.length === 0) {
    container.innerHTML = '<p class="empty-state">Your memories will appear here.</p>';
    return;
  }

  recent.forEach(memory => {
    container.appendChild(createMemoryCard(memory));
  });
}

// Render albums


function renderAlbums() {
  const container = document.getElementById("albumGrid");
  container.innerHTML = "";

  const groups = groupByAlbum(memories);

  const albums = Object.values(groups).sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  if (albums.length === 0) {
    container.innerHTML = `
      <p class="empty-state">
        No albums yet. Add your first memory.
      </p>
    `;
    return;
  }

  albums.forEach(albumData => {
    const { date, title, items } = albumData;

    const album = document.createElement("div");
    album.className = "album-card";

    // Album cover
    const cover = document.createElement("div");
    cover.className = "album-cover";
    cover.appendChild(createMediaElement(items[0]));

    // Album information
    const info = document.createElement("div");
    info.className = "album-info";

    const albumName = document.createElement("h3");
    albumName.textContent = title;

    const albumDate = document.createElement("p");
    albumDate.textContent = formatDate(date);

    const albumCount = document.createElement("p");
    albumCount.textContent = `${items.length} memories`;

    // Delete album button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-album-btn";
    deleteBtn.textContent = "Delete album";

    deleteBtn.onclick = async (event) => {
      event.stopPropagation();

      const confirmed = confirm(
        `Delete "${title}" and all ${items.length} memories inside it? This cannot be undone.`
      );

      if (!confirmed) return;

      await deleteAlbum(date, title);

      await render();
    };

    info.append(albumName, albumDate, albumCount, deleteBtn);
    album.append(cover, info);

    // Open album viewer when clicking the card
    album.onclick = () => openAlbum(date, title, items);

    container.appendChild(album);
  });
}



// Open album modal


function openAlbum(date, title, items) {
  currentAlbum = items;
  currentIndex = 0;

  const modal = document.getElementById("albumModal");

  // Display the custom album title
  document.getElementById("modalTitle").textContent = title;

  // Display album date under the title
  const subtitle = document.querySelector(".viewer-heading p");
  subtitle.textContent = formatDate(date);

  modal.classList.add("show");

  renderViewerMedia();
}


// Render the currently selected photo or video
function renderViewerMedia() {
  const container = document.getElementById("viewerMediaContainer");
  const counter = document.getElementById("viewerCounter");
  const caption = document.getElementById("viewerCaption");
  const dateLabel = document.getElementById("viewerDate");

  const prevBtn = document.getElementById("viewerPrev");
  const nextBtn = document.getElementById("viewerNext");

  container.innerHTML = "";

  if (!currentAlbum.length) return;

  const memory = currentAlbum[currentIndex];
  const media = createMediaElement(memory);

  media.className = "viewer-media";

  // Larger media display
  if (memory.file.type.startsWith("video/")) {
    media.classList.add("video");
    media.controls = true;
    media.autoplay = false;
  }

  if (memory.file.type.startsWith("image/")) {
    media.alt = memory.caption || "Memory";
  }

  container.appendChild(media);

  // Media counter
  counter.textContent = `${currentIndex + 1} / ${currentAlbum.length}`;

  // Caption
  caption.textContent = memory.caption || "A little memory";

  // Date
  dateLabel.textContent = formatDate(memory.date);

  // Navigation button states
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === currentAlbum.length - 1;
}

// Previous media
function previousMedia() {
  if (currentIndex > 0) {
    currentIndex--;
    renderViewerMedia();
  }
}

// Next media
function nextMedia() {
  if (currentIndex < currentAlbum.length - 1) {
    currentIndex++;
    renderViewerMedia();
  }
}


// Close modal

const albumModal = document.getElementById("albumModal");

// Close album
function closeAlbum() {
  albumModal.classList.remove("show");

  const container = document.getElementById("viewerMediaContainer");

  // Stop video playback when closing
  const video = container.querySelector("video");

  if (video) {
    video.pause();
    video.currentTime = 0;
  }
}

// Close button
document.getElementById("closeModal").onclick = closeAlbum;

// Clicking outside the album closes it
albumModal.onclick = (event) => {
  if (event.target === albumModal) {
    closeAlbum();
  }
};

// Navigation buttons
document.getElementById("viewerPrev").onclick = previousMedia;
document.getElementById("viewerNext").onclick = nextMedia;

// Keyboard controls
document.addEventListener("keydown", (event) => {
  if (!albumModal.classList.contains("show")) return;

  if (event.key === "Escape") {
    closeAlbum();
  }

  if (event.key === "ArrowLeft") {
    previousMedia();
  }

  if (event.key === "ArrowRight") {
    nextMedia();
  }
});


// Update stats
function updateStats() {
  document.getElementById("memoryCount").textContent = memories.length;

  const albumCount = Object.keys(groupByDate(memories)).length;
  document.getElementById("albumCount").textContent = albumCount;
}

// Render everything
async function render() {
  memories = await getMemories();

  renderRecent();
  renderAlbums();
  updateStats();
}

// Upload form
document.getElementById("uploadForm").addEventListener("submit", async (event) => {
  event.preventDefault();

const date = document.getElementById("memoryDate").value;
const albumTitle = document.getElementById("albumTitle").value.trim();
const caption = document.getElementById("memoryCaption").value.trim();
const files = document.getElementById("memoryFiles").files;

  if (!files.length) {
    alert("Please select at least one photo or video.");
    return;
  }

  for (const file of files) {
  await saveMemory({
    date,
    albumTitle,
    caption,
    file,
    type: file.type,
    name: file.name
  });
}

  event.target.reset();
  clearPreviews();
  document.getElementById("memoryDate").value = getToday();

  await render();

  alert("Your memories have been saved!");
});


/* ==========================================
   UPLOAD PREVIEW & DRAG-AND-DROP
========================================== */

const fileInput = document.getElementById("memoryFiles");
const dropZone = document.getElementById("dropZone");
const previewContainer = document.getElementById("filePreview");

let previewURLs = [];

// Clear previous previews and object URLs
function clearPreviews() {
  previewURLs.forEach(url => URL.revokeObjectURL(url));
  previewURLs = [];
  previewContainer.innerHTML = "";
}

// Render selected files
function renderFilePreviews(files) {
  clearPreviews();

  Array.from(files).forEach(file => {
    const previewURL = URL.createObjectURL(file);
    previewURLs.push(previewURL);

    const item = document.createElement("div");
    item.className = "preview-item";

    let media;

    if (file.type.startsWith("video/")) {
      media = document.createElement("video");
      media.src = previewURL;
      media.muted = true;
      media.playsInline = true;
    } else {
      media = document.createElement("img");
      media.src = previewURL;
      media.alt = file.name;
    }

    const name = document.createElement("div");
    name.className = "preview-name";
    name.textContent = file.name;

    const type = document.createElement("div");
    type.className = "preview-type";
    type.textContent = file.type.startsWith("video/")
      ? "VIDEO"
      : "PHOTO";

    item.append(media, name, type);
    previewContainer.appendChild(item);
  });
}

// When user selects files
fileInput.addEventListener("change", () => {
  renderFilePreviews(fileInput.files);
});

// Drag styling
["dragenter", "dragover"].forEach(eventName => {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    dropZone.classList.add("drag-over");
  });
});

["dragleave", "drop"].forEach(eventName => {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    dropZone.classList.remove("drag-over");
  });
});

// Handle dropped files
dropZone.addEventListener("drop", event => {
  const droppedFiles = Array.from(event.dataTransfer.files);

  const validFiles = droppedFiles.filter(file =>
    file.type.startsWith("image/") ||
    file.type.startsWith("video/")
  );

  if (!validFiles.length) {
    alert("Please drop photo or video files.");
    return;
  }

  // Assign dropped files to the input
  const dataTransfer = new DataTransfer();

  validFiles.forEach(file => dataTransfer.items.add(file));

  fileInput.files = dataTransfer.files;

  renderFilePreviews(fileInput.files);
});


// Initial setup
document.getElementById("today").textContent =
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

document.getElementById("memoryDate").value = getToday();

render();
/* ==========================================
   HEART EXPLOSION ON ALBUM CLICK
========================================== */

document.addEventListener("click", function (event) {

  const albumCard = event.target.closest(".album-card");

  // Ignore clicks outside albums
  if (!albumCard) return;

  // Ignore clicks on delete buttons
  if (event.target.closest("button")) return;

  const hearts = ["♡", "♥", "💕", "💗", "♡", "♥", "💖", "💘"];

  for (let i = 0; i < 8; i++) {

    const heart = document.createElement("span");
    heart.className = "heart-particle";

    heart.textContent = hearts[i];

    // Position at the cursor
    heart.style.left = `${event.clientX}px`;
    heart.style.top = `${event.clientY}px`;

    // Spread hearts in different directions
    const angle = (i / 8) * Math.PI * 2;
    const distance = 45 + Math.random() * 35;

    const moveX = Math.cos(angle) * distance;
    const moveY = Math.sin(angle) * distance;

    heart.style.setProperty("--move-x", `${moveX}px`);
    heart.style.setProperty("--move-y", `${moveY}px`);
    heart.style.setProperty("--rotation", `${Math.random() * 60 - 30}deg`);

    document.body.appendChild(heart);

    // Remove after animation finishes
    setTimeout(() => {
      heart.remove();
    }, 800);
  }
});