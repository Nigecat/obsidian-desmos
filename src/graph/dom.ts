/** Binds interaction event listeners to the given graph DOM object,
 *      this should persist until the element is removed from the DOM.
 */
export function bindEventListenersToGraph(element: HTMLElement) {
    const graph = element;
    // TODO - 2 or 3 for large graphs -> should be dynamically set based on graph size
    const scrollSpeed = 1;

    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;
    let velX = 0;
    let velY = 0;

    // -----------------------------------------------------------------------------------

    let momentumID = 0;

    function momentumLoop() {
        graph.scrollLeft += velX;
        graph.scrollTop += velY;
        velX *= 0.95;
        velY *= 0.95;
        if (Math.abs(velX) > 0.5 || Math.abs(velY) > 0.5) {
            momentumID = requestAnimationFrame(momentumLoop);
        }
    }

    function beginMomentumTracking() {
        cancelMomentumTracking();
        momentumID = requestAnimationFrame(momentumLoop);
    }

    function cancelMomentumTracking() {
        cancelAnimationFrame(momentumID);
    }

    // -----------------------------------------------------------------------------------

    // Default scroll to center of graph
    graph.scrollLeft = (graph.scrollWidth - graph.clientWidth) / 2;
    graph.scrollTop = (graph.scrollHeight - graph.clientHeight) / 2;

    graph.addEventListener("mousedown", (e) => {
        startX = e.pageX - graph.offsetLeft;
        startY = e.pageY - graph.offsetTop;
        scrollLeft = graph.scrollLeft;
        scrollTop = graph.scrollTop;
        cancelMomentumTracking();
    });

    graph.addEventListener("mouseup", () => {
        beginMomentumTracking();
    });

    graph.addEventListener("mousemove", (e) => {
        // Ensure primary mouse button is pressed
        if ((e.buttons & 1) !== 1) return;
        e.preventDefault();

        const x = e.pageX - graph.offsetLeft;
        const y = e.pageY - graph.offsetTop;
        const prevScrollLeft = graph.scrollLeft;
        const prevScrollTop = graph.scrollTop;
        const walk = (x - startX) * scrollSpeed;
        const jump = (y - startY) * scrollSpeed;
        graph.scrollLeft = scrollLeft - walk;
        graph.scrollTop = scrollTop - jump;
        velX = graph.scrollLeft - prevScrollLeft;
        velY = graph.scrollTop - prevScrollTop;
    });

    graph.addEventListener("wheel", () => cancelMomentumTracking());
}
