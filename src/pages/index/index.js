const projectsDiv = document.querySelector(".projects");

async function refreshProjects() {
    const projects = await __bridge__.getRecentProjects();
    const sorted = projects.sort((a, b) => b.editedTimestamp - a.editedTimestamp);
    projectsDiv.innerHTML = "";
    for (const p of sorted) {
        const div = document.createElement("div");
        div.classList.add("project");
        if (p.missing) div.classList.add("missing-project");
        div.innerHTML = `<div class="name">${p.name}</div>
<div class="edit-date">Last edited at: ${formatTime(p.editedTimestamp)}</div>`;
        div.addEventListener("click", () => {
            if (p.missing) {
                setPopupText("The project files are missing, do you wish to remove it from your recently viewed projects?", [
                    ["Cancel", hidePopup],
                    ["Delete", async () => {
                        await __bridge__.deleteRecentProject(p.path);
                        await refreshProjects();
                        hidePopup();
                    }, "#ff4242"]
                ])
                showPopup();
                return;
            }
            redirectTo("project", "?path=" + encodeURI(p.path));
        });
        projectsDiv.appendChild(div);
    }
}

await refreshProjects();

addEventListener("focus", refreshProjects);