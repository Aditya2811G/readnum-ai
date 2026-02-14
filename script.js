 const GEMINI_API_KEY = "API_KEY"; 

        // PASTE YOUR FIREBASE CONFIG HERE
 const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_BUCKET",
  messagingSenderId: "YOUR_ID",
  appId: "YOUR_APP_ID"
 };


        // --- IMPORTS ---
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
        import { 
            getAuth, 
            GoogleAuthProvider, 
            signInWithPopup, 
            createUserWithEmailAndPassword, 
            signInWithEmailAndPassword, 
            onAuthStateChanged, 
            signOut,
            updateProfile
        } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const googleProvider = new GoogleAuthProvider();

        // --- STATE ---
        let pendingFile = null;
        let isSignupMode = false;
        let currentUser = null;

        // --- DOM ELEMENTS ---
        const modalOverlay = document.getElementById('auth-modal-overlay');
        const closeModalBtn = document.getElementById('close-modal');
        const modalTitle = document.getElementById('modal-title');
        const toggleText = document.getElementById('toggle-text');
        const toggleLink = document.getElementById('toggle-link');
        const submitBtn = document.getElementById('submit-btn');
        const authError = document.getElementById('auth-error');
        const loggedOutNav = document.getElementById('auth-logged-out');
        const loggedInNav = document.getElementById('auth-logged-in');
        const userAvatar = document.getElementById('user-avatar');
        
        // New Field Elements
        const groupName = document.getElementById('group-name');
        const groupConfirm = document.getElementById('group-confirm');
        const inputName = document.getElementById('input-name');
        const inputConfirm = document.getElementById('input-confirm');
        const inputPassword = document.getElementById('input-password');
        
        // --- AUTHENTICATION FUNCTIONS ---
        
        // 1. Observer: Check login status
        onAuthStateChanged(auth, (user) => {
            currentUser = user;
            if (user) {
                // Logged In
                loggedOutNav.style.display = 'none';
                loggedInNav.style.display = 'flex';
                
                // Set Avatar
                if(user.photoURL) {
                    userAvatar.innerHTML = `<img src="${user.photoURL}" alt="User">`;
                } else {
                    userAvatar.textContent = (user.displayName || user.email || "U").charAt(0).toUpperCase();
                }

                closeModal();

                // If user uploaded file before logging in
                if (pendingFile) {
                    processFile(pendingFile);
                    pendingFile = null;
                }
            } else {
                // Logged Out
                loggedOutNav.style.display = 'flex';
                loggedInNav.style.display = 'none';
            }
        });

        // 2. Google Login
        document.getElementById('google-btn').addEventListener('click', async () => {
            try {
                await signInWithPopup(auth, googleProvider);
            } catch (error) {
                showError(error.message);
            }
        });

        // 3. Email Login/Signup
        document.getElementById('email-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('input-email').value;
            const password = inputPassword.value;
            
            try {
                if (isSignupMode) {
                    // Sign Up Logic
                    const name = inputName.value;
                    const confirm = inputConfirm.value;

                    if(password !== confirm) {
                        showError("Passwords do not match.");
                        return;
                    }
                    if(!name) {
                        showError("Please enter your name.");
                        return;
                    }

                    // Create User
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    
                    // Update Name Profile
                    await updateProfile(userCredential.user, {
                        displayName: name
                    });

                    // Force reload to update UI with new name immediately
                    window.location.reload();

                } else {
                    // Login Logic
                    await signInWithEmailAndPassword(auth, email, password);
                }
            } catch (error) {
                showError(cleanAuthError(error.message));
            }
        });

        // 4. Logout
        document.getElementById('btn-logout').addEventListener('click', () => {
            signOut(auth);
            resetUI();
        });

        // --- MODAL LOGIC ---
        
        // Expose to global scope for HTML onclick
        window.openModal = (signup = false) => {
            modalOverlay.classList.add('active');
            toggleAuthMode(signup);
            authError.style.display = 'none';
        }

        function closeModal() {
            modalOverlay.classList.remove('active');
        }
        
        closeModalBtn.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => {
            if(e.target === modalOverlay) closeModal();
        });

        function toggleAuthMode(signup) {
            isSignupMode = signup;
            if (signup) {
                // Show Sign Up UI
                modalTitle.textContent = "Create Account";
                submitBtn.textContent = "Sign Up";
                toggleText.textContent = "Already have an account?";
                toggleLink.textContent = "Log In";
                
                // Show extra fields
                groupName.style.display = 'block';
                groupConfirm.style.display = 'block';
                inputName.required = true;
                inputConfirm.required = true;
            } else {
                // Show Login UI
                modalTitle.textContent = "Welcome Back";
                submitBtn.textContent = "Sign In";
                toggleText.textContent = "Don't have an account?";
                toggleLink.textContent = "Sign Up";
                
                // Hide extra fields
                groupName.style.display = 'none';
                groupConfirm.style.display = 'none';
                inputName.required = false;
                inputConfirm.required = false;
            }
        }

        toggleLink.addEventListener('click', () => toggleAuthMode(!isSignupMode));

        function showError(msg) {
            authError.textContent = msg;
            authError.style.display = 'block';
        }

        function cleanAuthError(msg) {
            if(msg.includes('auth/invalid-email')) return "Invalid email address.";
            if(msg.includes('auth/wrong-password')) return "Incorrect password.";
            if(msg.includes('auth/user-not-found')) return "No account found with this email.";
            if(msg.includes('auth/email-already-in-use')) return "Email already in use.";
            if(msg.includes('auth/weak-password')) return "Password should be at least 6 characters.";
            return "Authentication failed. Please try again.";
        }

        // --- FILE HANDLING & GEMINI API ---

        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('fileInput');
        const previewImg = document.getElementById('preview');
        const placeholder = document.getElementById('placeholder');
        const spinner = document.getElementById('spinner');
        const resultLabel = document.getElementById('result-label');
        const resultValue = document.getElementById('result-value');

        // Drag & Drop Events
        dropZone.addEventListener('click', () => fileInput.click());
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) handleFile(e.target.files[0]);
        });

        function handleFile(file) {
            if (!file.type.startsWith('image/')) {
                alert("Please upload a valid image (PNG/JPG).");
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                previewImg.style.display = 'block';
                placeholder.style.display = 'none';
                
                resultLabel.style.display = 'none';
                resultValue.style.display = 'none';

                if (currentUser) {
                    processFile(file);
                } else {
                    pendingFile = file;
                    window.openModal(false); // Trigger login
                }
            };
            reader.readAsDataURL(file);
        }

        async function processFile(file) {
            spinner.style.display = 'block';

            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64Data = e.target.result.split(',')[1];
                try {
                    const number = await callGeminiAPI(base64Data, file.type);
                    displayResult(number);
                } catch (error) {
                    console.error(error);
                    spinner.style.display = 'none';
                    alert("Error processing image. Check your API Key.");
                }
            };
            reader.readAsDataURL(file);
        }

        async function callGeminiAPI(base64Image, mimeType) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
            
            const payload = {
                contents: [{
                    parts: [
                        { text: "Identify the single handwritten digit or number in this image. Return ONLY the number. No extra text." },
                        { inlineData: { mimeType: mimeType, data: base64Image } }
                    ]
                }]
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            return text ? text.trim() : "?";
        }

        function displayResult(text) {
            spinner.style.display = 'none';
            resultLabel.style.display = 'block';
            resultValue.textContent = text;
            resultValue.style.display = 'block';
        }

        function resetUI() {
            previewImg.style.display = 'none';
            placeholder.style.display = 'block';
            resultValue.style.display = 'none';
            resultLabel.style.display = 'none';
            fileInput.value = '';

        }
