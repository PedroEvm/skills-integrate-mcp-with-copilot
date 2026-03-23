document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const userIconBtn = document.getElementById("user-icon-btn");
  const userMenu = document.getElementById("user-menu");
  const authStatus = document.getElementById("auth-status");
  const authActionBtn = document.getElementById("auth-action-btn");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const cancelLoginBtn = document.getElementById("cancel-login");
  const teacherUsernameInput = document.getElementById("teacher-username");
  const teacherPasswordInput = document.getElementById("teacher-password");

  let teacherToken = localStorage.getItem("teacherToken") || "";
  let teacherUsername = localStorage.getItem("teacherUsername") || "";

  function showMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function isTeacherLoggedIn() {
    return Boolean(teacherToken);
  }

  function setAuthenticatedState(token, username) {
    teacherToken = token;
    teacherUsername = username;
    localStorage.setItem("teacherToken", token);
    localStorage.setItem("teacherUsername", username);
    updateAuthUI();
  }

  function clearAuthenticatedState() {
    teacherToken = "";
    teacherUsername = "";
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("teacherUsername");
    updateAuthUI();
  }

  function updateAuthUI() {
    const loggedIn = isTeacherLoggedIn();
    signupForm.querySelectorAll("input, select, button").forEach((field) => {
      field.disabled = !loggedIn;
    });

    if (loggedIn) {
      authStatus.textContent = `Teacher mode: ${teacherUsername}`;
      authActionBtn.textContent = "Logout";
    } else {
      authStatus.textContent = "Student mode";
      authActionBtn.textContent = "Login";
    }
  }

  async function validateStoredSession() {
    if (!teacherToken) {
      updateAuthUI();
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: {
          "X-Teacher-Token": teacherToken,
        },
      });

      if (!response.ok) {
        clearAuthenticatedState();
      }
    } catch (error) {
      clearAuthenticatedState();
      console.error("Failed to validate session", error);
    }

    updateAuthUI();
  }

  function openLoginModal() {
    loginModal.classList.remove("hidden");
    teacherUsernameInput.focus();
  }

  function closeLoginModal() {
    loginModal.classList.add("hidden");
    loginForm.reset();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn ${
                        isTeacherLoggedIn() ? "" : "hidden"
                      }" data-activity="${name}" data-email="${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
          const option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!isTeacherLoggedIn()) {
      showMessage("Only logged-in teachers can unregister students.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            "X-Teacher-Token": teacherToken,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 401) {
          clearAuthenticatedState();
        }
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isTeacherLoggedIn()) {
      showMessage("Only logged-in teachers can register students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            "X-Teacher-Token": teacherToken,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 401) {
          clearAuthenticatedState();
        }
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // User menu interactions
  userIconBtn.addEventListener("click", () => {
    userMenu.classList.toggle("hidden");
  });

  document.addEventListener("click", (event) => {
    const clickedInsideMenu = event.target.closest("#user-menu-container");
    if (!clickedInsideMenu) {
      userMenu.classList.add("hidden");
    }
  });

  authActionBtn.addEventListener("click", async () => {
    if (!isTeacherLoggedIn()) {
      openLoginModal();
      return;
    }

    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: {
          "X-Teacher-Token": teacherToken,
        },
      });
    } catch (error) {
      console.error("Logout request failed", error);
    }

    clearAuthenticatedState();
    fetchActivities();
    showMessage("Logged out. Student mode is active.", "info");
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = teacherUsernameInput.value.trim();
    const password = teacherPasswordInput.value;

    try {
      const response = await fetch(
        `/auth/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();
      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      setAuthenticatedState(result.token, result.username);
      closeLoginModal();
      fetchActivities();
      showMessage(`Logged in as ${result.username}`, "success");
    } catch (error) {
      showMessage("Failed to login. Please try again.", "error");
      console.error("Login failed", error);
    }
  });

  cancelLoginBtn.addEventListener("click", closeLoginModal);

  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      closeLoginModal();
    }
  });

  // Initialize app
  validateStoredSession().then(fetchActivities);
});
