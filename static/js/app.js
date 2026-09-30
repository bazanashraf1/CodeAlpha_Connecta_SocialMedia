const state = { user: null, posts: [] };

const $ = s => document.querySelector(s);

function cookie(name) {
    const row = document.cookie.split("; ").find(x => x.startsWith(name + "="));
    return row ? decodeURIComponent(row.split("=").slice(1).join("=")) : "";
}

async function api(url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");
    headers.set("X-CSRFToken", cookie("csrftoken"));
    const response = await fetch(url, {...options, headers, credentials:"same-origin"});
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.message || data.detail || "Request failed.");
    return data;
}

function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2600);
}

function esc(value="") {
    return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;")
        .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function initials(name="?") {
    return (name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("") || "?").toUpperCase();
}

function authModal(view="login") {
    $("#auth-modal").classList.remove("hidden");
    $("#login-view").classList.toggle("hidden", view !== "login");
    $("#register-view").classList.toggle("hidden", view !== "register");
}
function closeModal(){ $("#auth-modal").classList.add("hidden"); }

function updateUI(){
    const logged = !!state.user;
    $("#nav-login").classList.toggle("hidden", logged);
    $("#nav-register").classList.toggle("hidden", logged);
    $("#nav-logout").classList.toggle("hidden", !logged);
    $("#post-form").classList.toggle("hidden", !logged);
    $("#guest-banner").classList.toggle("hidden", logged);

    const name = logged ? (state.user.first_name || state.user.username) : "Guest";
    $("#profile-name").textContent = name;
    $("#profile-bio").textContent = logged ? (state.user.bio || "Connecta community member.") : "Join Connecta and share your ideas.";
    $("#profile-followers").textContent = logged ? state.user.followers : 0;
    $("#profile-following").textContent = logged ? state.user.following : 0;
    $("#profile-avatar").textContent = logged ? initials(name) : "?";
    $("#composer-avatar").textContent = logged ? initials(name) : "?";
}

async function loadMe(){
    try { state.user = (await api("/api/me/")).user; }
    catch (_) { state.user = null; }
    updateUI();
}

async function loadFeed(){
    $("#feed-list").innerHTML = '<div class="empty">Loading feed...</div>';
    try {
        state.posts = (await api("/api/feed/")).posts || [];
        renderFeed();
    } catch(error) {
        $("#feed-list").innerHTML = `<div class="empty">${esc(error.message)}</div>`;
    }
}

function renderFeed(){
    if (!state.posts.length) {
        $("#feed-list").innerHTML = '<div class="empty"><h3>No posts yet</h3><p>Be the first to publish something.</p></div>';
        return;
    }

    $("#feed-list").innerHTML = state.posts.map(post => {
        const own = state.user && Number(post.author_id) === Number(state.user.id);
        const comments = post.comments.length
            ? post.comments.map(c => `<div class="comment"><b>${esc(c.username)}</b> ${esc(c.text)}<br><small>${esc(c.created_at)}</small></div>`).join("")
            : '<p class="meta">No comments yet.</p>';

        return `<article class="card post" data-id="${post.id}">
            <div class="post-head">
                <div class="author">
                    <div class="avatar">${esc(initials(post.username))}</div>
                    <div><b>@${esc(post.username)}</b><div class="meta">${esc(post.created_at)}</div></div>
                </div>
                ${own ? '<button class="danger" data-action="delete">Delete</button>' : ""}
            </div>
            <div class="post-content">${esc(post.content)}</div>
            ${post.image_url ? `<img class="post-image" src="${esc(post.image_url)}" onerror="this.style.display='none'" alt="Post image">` : ""}
            <div class="actions">
                <button class="action ${post.liked ? "active":""}" data-action="like">${post.liked ? "♥":"♡"} ${post.likes} Like${post.likes===1?"":"s"}</button>
                <button class="action" data-action="comment-focus">💬 ${post.comments.length} Comment${post.comments.length===1?"":"s"}</button>
                ${state.user && !own ? '<button class="action" data-action="follow">Follow / Unfollow</button>' : ""}
            </div>
            <div class="comments">
                ${comments}
                ${state.user ? `<form class="comment-form"><input name="comment" maxlength="500" placeholder="Write a comment..." required><button class="btn primary">Send</button></form>` : ""}
            </div>
        </article>`;
    }).join("");
}

async function register(e){
    e.preventDefault();
    try {
        await api("/api/register/", {
            method:"POST",
            body:JSON.stringify({
                first_name:$("#register-name").value.trim(),
                username:$("#register-username").value.trim(),
                email:$("#register-email").value.trim(),
                password:$("#register-password").value
            })
        });
        const email = $("#register-email").value.trim();
        $("#register-form").reset();
        $("#login-email").value = email;
        authModal("login");
        toast("Account created. Please login.");
    } catch(error){ toast(error.message); }
}

async function login(e){
    e.preventDefault();
    try {
        state.user = (await api("/api/login/", {
            method:"POST",
            body:JSON.stringify({
                email:$("#login-email").value.trim(),
                password:$("#login-password").value
            })
        })).user;
        $("#login-form").reset();
        closeModal();
        updateUI();
        await loadFeed();
        toast("Login successful.");
    } catch(error){ toast(error.message); }
}

async function logout(){
    try { await api("/api/logout/", {method:"POST"}); } catch(_){}
    state.user = null;
    updateUI();
    await loadFeed();
    toast("Logged out.");
}

async function createPost(e){
    e.preventDefault();
    const content = $("#post-content").value.trim();
    if (!content) return toast("Write something first.");
    try {
        await api("/api/posts/", {
            method:"POST",
            body:JSON.stringify({content, image_url:$("#post-image").value.trim()})
        });
        $("#post-form").reset();
        await loadFeed();
        toast("Post published.");
    } catch(error){ toast(error.message); }
}

async function likePost(id){
    if (!state.user) return authModal("login");
    try { await api(`/api/posts/${id}/like/`, {method:"POST"}); await loadFeed(); }
    catch(error){ toast(error.message); }
}

async function followPostAuthor(id){
    if (!state.user) return authModal("login");
    const post = state.posts.find(p => Number(p.id) === Number(id));
    if (!post) return;
    try {
        const data = await api(`/api/users/${post.author_id}/follow/`, {method:"POST"});
        await loadMe();
        toast(data.following ? "User followed." : "User unfollowed.");
    } catch(error){ toast(error.message); }
}

async function deletePost(id){
    if (!confirm("Delete this post?")) return;
    try {
        await api(`/api/posts/${id}/`, {method:"DELETE"});
        await loadFeed();
        toast("Post deleted.");
    } catch(error){ toast(error.message); }
}

async function commentPost(id, form){
    const text = form.comment.value.trim();
    if (!text) return;
    try {
        await api(`/api/posts/${id}/comment/`, {
            method:"POST", body:JSON.stringify({text})
        });
        form.reset();
        await loadFeed();
    } catch(error){ toast(error.message); }
}

function setup(){
    $("#nav-login").onclick = () => authModal("login");
    $("#nav-register").onclick = () => authModal("register");
    $("#nav-logout").onclick = logout;
    $("#auth-close").onclick = closeModal;
    $("#switch-register").onclick = () => authModal("register");
    $("#switch-login").onclick = () => authModal("login");
    $("#login-form").onsubmit = login;
    $("#register-form").onsubmit = register;
    $("#post-form").onsubmit = createPost;
    $("#refresh-feed").onclick = loadFeed;

    $("#feed-list").addEventListener("click", async e => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;
        const card = btn.closest("[data-id]");
        if (!card) return;
        const id = card.dataset.id;
        if (btn.dataset.action === "like") await likePost(id);
        if (btn.dataset.action === "follow") await followPostAuthor(id);
        if (btn.dataset.action === "delete") await deletePost(id);
        if (btn.dataset.action === "comment-focus") card.querySelector("input[name='comment']")?.focus();
    });

    $("#feed-list").addEventListener("submit", async e => {
        const form = e.target.closest(".comment-form");
        if (!form) return;
        e.preventDefault();
        await commentPost(form.closest("[data-id]").dataset.id, form);
    });

    $("#auth-modal").addEventListener("click", e => {
        if (e.target.id === "auth-modal") closeModal();
    });
}

async function start(){
    setup();
    await loadMe();
    await loadFeed();
}

start();

window.CONNECTA = {
    reload: loadFeed,
    getPosts: () => state.posts,
    getUser: () => state.user
};
