const login_form = document.querySelector('.loginForm');

login_form.addEventListener('submit', async function (event) {
    event.preventDefault();
  
    const usernameEl = document.getElementById('login-input-username');
    const passwordEl = document.getElementById('login-input-password');
    const username = usernameEl.value;
    const password = passwordEl.value;

    // Clear inputs
    usernameEl.value = '';
    passwordEl.value = '';

    try {
        const response = await fetch("/login", {
            method: "POST",
            body: JSON.stringify({ username, password }),
            headers: { "Content-Type": "application/json" }
        });
        if (!response.ok) {
            if (response.status === 401) {
                document.querySelector('.invalid-login-text').style.display = "block";
                return;
            }
            throw new Error(`Response status: ${response.status}`)
        }

        const result = await response.json();
        if (result.message === "login successful") {
            window.location.href = 'chat.html';
        }
    } catch (error) {
        console.error(`An error occurred: ${error}`);
    }
});