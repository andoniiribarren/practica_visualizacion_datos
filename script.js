// Crear tooltip
const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

const regionData = {};

let data; 

// Cargamos dataset
d3.csv("vgchartz-2024.csv").then(rawData => {
  data = rawData;

  // Generamos regiones y ponemos contadores a 0
  const regiones = {
    NA: { ventas: 0, juegos: []},
    JP: { ventas: 0, juegos: []},
    PAL: { ventas: 0, juegos: []},
    Other: { ventas: 0, juegos: []}
  };

  // Hacemos top de consolas para el filtro (top 15)
  const ventasPorConsola = d3.rollups(
  data,
  v => d3.sum(v, d => +d.total_sales),
  d => d.console
  );

  const topConsolas = ventasPorConsola
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([consola]) => consola);


  const consolasUnicas = [...topConsolas];
  const select = d3.select("#consola-select");

  consolasUnicas.forEach(consola => {
    select.append("option")
      .attr("value", consola)
      .text(consola);
  });

  // Agrupamos los juegos por regiones
  data.forEach(d => {
    // Normalizamos
    d.total_sales = +d.total_sales;
    d.na_sales = +d.na_sales;
    d.jp_sales = +d.jp_sales;
    d.pal_sales = +d.pal_sales;
    d.other_sales = +d.other_sales;
    d.critic_score = +d.critic_score;

    
    regiones.NA.ventas += d.na_sales;
    regiones.JP.ventas += d.jp_sales;
    regiones.PAL.ventas += d.pal_sales;
    regiones.Other.ventas += d.other_sales;

    if (d.na_sales > 0) regiones.NA.juegos.push(d);
    if (d.jp_sales > 0) regiones.JP.juegos.push(d);
    if (d.pal_sales > 0) regiones.PAL.juegos.push(d);
    if (d.other_sales > 0) regiones.Other.juegos.push(d);
  });

  // Cálculo de métricas por región
  for (let key in regiones) {
    let region = regiones[key];

    // Juego más vendido (según total_sales)
    const topGame = region.juegos.reduce((max, g) => (g.total_sales > max.total_sales ? g : max), region.juegos[0] || { total_sales: 0 });

    // Género más vendido
    const genreSales = {};
    region.juegos.forEach(g => {
      genreSales[g.genre] = (genreSales[g.genre] || 0) + g.total_sales;
    });
    const topGenre = Object.entries(genreSales).sort((a,b) => b[1] - a[1])[0]?.[0] || "N/A";

    // Publicador mejor puntuado con al menos 5 juegos
    const devScores = {};
    const devCounts = {};
    region.juegos.forEach(g => {
      if (!isNaN(g.critic_score)) {
        devScores[g.publisher] = (devScores[g.publisher] || 0) + g.critic_score;
        devCounts[g.publisher] = (devCounts[g.publisher] || 0) + 1;
      }
    });
    let topDev = "N/A";
    let maxAvg = 0;
    for (const dev in devScores) {
      const avg = devScores[dev] / devCounts[dev];
      if (devCounts[dev] >= 5 && avg > maxAvg) {
        maxAvg = avg;
        topDev = dev;
      }
    }

    // Rellenamos info
    regionData[key] = {
      name: key,
      x: region.x,
      y: region.y,
      sales: region.ventas,
      topGame: topGame?.title || "N/A",
      topGenre,
      topDev,
      img: topGame?.img ? `https://www.vgchartz.com${topGame.img}` : null
    };
  }

  // Dibujamos burbujas, si hay filtro de consolas actualizamos
  dibujarBurbujas('all')
  d3.select("#consola-select").on("change", function () {
    const consola = this.value;
    dibujarBurbujas(consola);
  });
});

// Función para generar tabla y efectos al tocar burbuja
function generarTabFX(selection) {
  // Oscurecer y agrandar burbujas
  selection
    .on("mouseover", (event, d) => {
      d3.select(event.currentTarget)
        .transition().duration(200)
        .attr("fill", "brown")
        .attr("r", function() {
          return d3.select(this).attr("r") * 1.2;
        });
      //Generar tooltip
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip.html(`
        <strong>${d.name}</strong><br/>
        <em>Ventas totales:</em> ${d.sales.toFixed(2)}M<br/>
        <em>Género más vendido:</em> ${d.topGenre || "N/A"}<br/>
        <em>Desarrollador mejor puntuado:</em> ${d.topDev || "N/A"}<br/>
        <em>Juego más vendido:</em> ${d.topGame?.title || "N/A"}<br/>
        ${d.topGame?.img ? `<img src="https://www.vgchartz.com${d.topGame.img}" alt="${d.topGame.title}" style="max-width:120px;"/>` : ''}
      `)
      .style("left", `${d3.pointer(event, svg.node())[0] + 15}px`)
      .style("top", `${d3.pointer(event, svg.node())[1] - 40}px`);
    })
    .on("mouseout", (event) => {
      d3.select(event.currentTarget)
        .transition().duration(400)
        .attr("fill", "orange")
        .attr("r", function() {
          return d3.select(this).attr("r") / 1.2;
        });

      tooltip.transition().duration(400).style("opacity", 0);
    });
}


// Función que dibuja las burbujas y su radio
function dibujarBurbujas(consolaSeleccionada) {
  // filtro por consola
  const dataFiltrada = consolaSeleccionada === "all"
    ? data
    : data.filter(d => d.console === consolaSeleccionada);

  // Posiciones burbujas
  const regiones = {
    "NA": { x: 150, y: 200, name: "Norteamérica" },
    "JP": { x: 670, y: 220, name: "Asia/Japón" },
    "PAL": { x: 400, y: 180, name: "Europa" },
    "Other": { x: 700, y: 380, name: "Otras regiones" }
  };

  const regionData = {};
  // Cálculo métricas por región
  Object.entries(regiones).forEach(([clave, { x, y, name }]) => {
    const juegos = dataFiltrada.filter(d => +d[clave.toLowerCase() + "_sales"] > 0);
    const ventas = d3.sum(juegos, d => +d[clave.toLowerCase() + "_sales"]);

    // Juego más vendido
    let topGame = null;
    if (juegos.length > 0) {
      topGame = juegos.reduce((max, g) =>
        +g[clave.toLowerCase() + "_sales"] > +max[clave.toLowerCase() + "_sales"] ? g : max
      );
    }

    // Género más vendido por total_sales
    const genreSales = {};
    juegos.forEach(g => {
      if (g.genre && g.genre !== "N/A" && g.genre !== "Unknown") {
        genreSales[g.genre] = (genreSales[g.genre] || 0) + +g.total_sales;
      }
    });
    const topGenre = Object.entries(genreSales).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    // Publicador con mejor puntuación con al menos 5 juegos
    const devScores = {};
    const devCounts = {};
    juegos.forEach(g => {
      if (g.publisher && g.publisher !== "N/A" && g.publisher !== "Unknown" && !isNaN(g.critic_score)) {
        devScores[g.publisher] = (devScores[g.publisher] || 0) + g.critic_score;
        devCounts[g.publisher] = (devCounts[g.publisher] || 0) + 1;
      }
    });
    let topDev = "N/A";
    let maxAvg = 0;
    for (const dev in devScores) {
      const avg = devScores[dev] / devCounts[dev];
      if (devCounts[dev] >= 5 && avg > maxAvg) {
        maxAvg = avg;
        topDev = dev;
      }
    }

    regionData[clave] = {
      name,
      x,
      y,
      sales: ventas,
      topGame: topGame ? {
        title: topGame.title || "N/A",
        img: topGame.img ? `${topGame.img}` : null
      } : { title: "N/A", img: null },
      topGenre,
      topDev
    };
  });

  // Reescalado de radio según volumen ventas
  const maxVentas = d3.max(Object.values(regionData), d => d.sales);
  const radiusScale = d3.scaleSqrt().domain([0, maxVentas]).range([5, 50]);

  const svg = d3.select("#bubbles-svg");

  // Dibujar las burbujas en sí
  const burbujas = svg.selectAll("circle")
    .data(Object.values(regionData), d => d.name);

  burbujas.join(
    enter => enter.append("circle")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", 0)
      .attr("fill", "orange")
      .attr("stroke", "#fff")
      .attr("fill-opacity", 0.8)
      .transition()
      .duration(500)
      .attr("r", d => radiusScale(d.sales)),
    update => update.transition()
      .duration(500)
      .attr("r", d => radiusScale(d.sales))
  );

  // Tabla y efectos al hacer mouseover
  generarTabFX(svg.selectAll("circle"));
}
