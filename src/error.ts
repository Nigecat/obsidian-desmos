export function renderError(err: string, el: HTMLElement) {
    const message = document.createElement("strong");
    message.innerText = "Desmos Graph Error: ";

    const ctx = document.createElement("span");
    ctx.innerText = err;

    const wrapper = document.createElement("div");
    wrapper.appendChild(message);
    wrapper.appendChild(ctx);

    const container = document.createElement("div");
    container.style.padding = "20px";
    container.style.backgroundColor = "#f44336";
    container.style.color = "white";
    container.appendChild(wrapper);

    el.empty();
    el.appendChild(container);
}
