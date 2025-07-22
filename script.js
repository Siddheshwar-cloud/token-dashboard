const TOKEN_ADDRESS = "0xdee91bC4aCDfAED1c19aAc3caC81d80683ea6b39";
const ETHERSCAN_API_KEY = "IP6PE7UA6IPP16J2MA7HXBAKHCA3Y2PUZ1";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 value) returns (bool)"
];

let provider, signer, userAddress;
let autoRefreshInterval = null;

const connectSound = new Audio("https://cdn.pixabay.com/audio/2022/03/24/audio_367cb0a2b2.mp3");
const sendSound = new Audio("https://cdn.pixabay.com/audio/2022/03/15/audio_3853cf54fd.mp3");

// 🌌 Particle.js Setup
window.addEventListener("DOMContentLoaded", () => {
  // Load particle background into correct ID
  particlesJS.load("particles-js", "https://cdn.jsdelivr.net/gh/VincentGarreau/particles.js/particles.json", () => {
    console.log("✨ Particle background loaded.");
  });

  // 🌗 Restore theme
  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-theme");
  }

  // 🌗 Theme toggle listener
  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      document.body.classList.toggle("light-theme");
      localStorage.setItem(
        "theme",
        document.body.classList.contains("light-theme") ? "light" : "dark"
      );
    });
  }
});

// 🔗 Connect wallet
async function connectAndLoad() {
  if (!window.ethereum) {
    alert("❌ MetaMask not found!");
    return;
  }

  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();

    document.getElementById("userAddress").innerText = userAddress;

    const btn = document.getElementById("connectBtn");
    btn.innerText = "🟢 Connected";
    btn.disabled = true;
    btn.classList.add("connected");

    connectSound.play();

    await loadBalances();
    await loadENS();
    await fetchRecentTxs();

    if (!autoRefreshInterval) {
      autoRefreshInterval = setInterval(() => {
        if (userAddress) {
          loadBalances();
          fetchRecentTxs();
        }
      }, 30000);
    }

  } catch (err) {
    console.error("⚠️ Wallet connection failed:", err.message);
  }
}

// 💰 Load balances
async function loadBalances() {
  try {
    const ethBal = await provider.getBalance(userAddress);
    document.getElementById("ethBalance").innerText = `Ξ ${ethers.utils.formatEther(ethBal)}`;

    const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);
    const raw = await token.balanceOf(userAddress);
    const decimals = await token.decimals();
    const symbol = await token.symbol();
    const formatted = ethers.utils.formatUnits(raw, decimals);

    document.getElementById("tokenBalance").innerText = `${formatted} ${symbol}`;
  } catch (err) {
    console.error("❌ Balance fetch error:", err.message);
  }
}

// 🌐 ENS lookup
async function loadENS() {
  try {
    const ensName = await provider.lookupAddress(userAddress);
    document.getElementById("ensName").innerText = ensName || "Not registered";

    if (ensName) {
      const avatar = await provider.getAvatar(ensName);
      if (avatar) {
        const avatarImg = document.getElementById("ensAvatar");
        avatarImg.src = avatar;
        avatarImg.style.display = "block";
      }
    }
  } catch (e) {
    console.warn("⚠️ ENS unsupported or unavailable.");
    document.getElementById("ensName").innerText = "Unavailable";
  }
}

// 📋 Copy wallet
async function copyAddress() {
  if (userAddress) {
    await navigator.clipboard.writeText(userAddress);
    alert("📋 Wallet address copied!");
  } else {
    alert("⚠️ Wallet not connected.");
  }
}

// 🔳 QR Code
function toggleQR() {
  const qrPopup = document.getElementById("qrPopup");
  qrPopup.innerHTML = "";

  if (!userAddress) {
    alert("⚠️ Connect wallet first.");
    return;
  }

  if (qrPopup.style.display === "block") {
    qrPopup.style.display = "none";
  } else {
    const uri = `ethereum:${userAddress}`;

    new QRCode(qrPopup, {
      text: uri,
      width: 128,
      height: 128,
      colorDark: "#ffffff",
      colorLight: "#000000",
      correctLevel: QRCode.CorrectLevel.H
    });

    const link = document.createElement("p");
    link.innerHTML = `🔗 <a href="https://sepolia.etherscan.io/address/${userAddress}" target="_blank">${userAddress}</a>`;
    link.style.marginTop = "10px";
    link.style.wordBreak = "break-word";

    qrPopup.appendChild(link);
    qrPopup.style.display = "block";
  }
}

// 📜 Fetch recent txs
async function fetchRecentTxs() {
  const url = `https://api-sepolia.etherscan.io/api?module=account&action=txlist&address=${userAddress}&startblock=0&endblock=99999999&page=1&offset=5&sort=desc&apikey=${ETHERSCAN_API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const txContainer = document.getElementById("txList");
    txContainer.innerHTML = "";

    if (data.status !== "1" || !data.result.length) {
      txContainer.innerText = "No transactions found.";
      return;
    }

    data.result.forEach(tx => {
      const item = document.createElement("div");
      item.style.borderBottom = "1px solid #333";
      item.style.padding = "8px 0";
      item.innerHTML = `
        <p><strong>🔁 Hash:</strong> <a href="https://sepolia.etherscan.io/tx/${tx.hash}" target="_blank">${tx.hash.slice(0, 12)}...</a></p>
        <p><strong>📤 From:</strong> ${tx.from.slice(0, 8)}...</p>
        <p><strong>📥 To:</strong> ${tx.to.slice(0, 8)}...</p>
        <p><strong>💰 Value:</strong> ${ethers.utils.formatEther(tx.value)} ETH</p>
        <p><strong>⏱ Time:</strong> ${new Date(tx.timeStamp * 1000).toLocaleString()}</p>
      `;
      txContainer.appendChild(item);
    });
  } catch (err) {
    console.error("❌ TX Fetch Error:", err.message);
  }
}

// 🚀 Send tokens
async function sendToken() {
  const to = document.getElementById("sendTo").value.trim();
  const amount = document.getElementById("sendAmount").value.trim();

  if (!ethers.utils.isAddress(to)) {
    alert("⚠️ Invalid recipient address.");
    return;
  }

  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    alert("⚠️ Invalid token amount.");
    return;
  }

  try {
    const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
    const decimals = await token.decimals();
    const symbol = await token.symbol();
    const parsedAmount = ethers.utils.parseUnits(amount, decimals);

    const tx = await token.transfer(to, parsedAmount);
    alert(`🚀 Transaction sent!\n⛓ Hash: ${tx.hash}`);

    // ✨ Glow + Sound
    document.body.classList.add("sending");
    sendSound.play();

    await tx.wait();

    setTimeout(() => {
      document.body.classList.remove("sending");
    }, 1500);

    alert(`✅ ${amount} ${symbol} sent to ${to}!`);

    await loadBalances();
    await fetchRecentTxs();
  } catch (err) {
    console.error("❌ Transfer failed:", err);
    alert(`❌ Transfer failed: ${err.message}`);
  }
}
