let seccionActual = "login";
let idGestor = null;
let recursoActual = null;

let token = null;   // PRÁCTICA 3 - PARTE 2: el token JWT que nos da el login


/* ===============================
   PRÁCTICA 3 - PARTE 2: fetch CON TOKEN
   Es igual que fetch, pero añade el token al final de la URL
   (como en el ejemplo del profesor):
      /api/recursos            ->  /api/recursos?token=XXXX
      /api/recursos?modelo=2&  ->  /api/recursos?modelo=2&token=XXXX
   Todas las llamadas a NUESTRO servidor usan fetchToken.
================================ */
function fetchToken(url, opciones){
    if (token != null){
        // ver si la url ya tiene parametros o no
        if (url.indexOf("?") == -1) url = url + "?token=" + token;          // la URL no tenía ?
        else if (url.endsWith("?") || url.endsWith("&")) url = url + "token=" + token; // ya acaba en ? o &
        else url = url + "&token=" + token;                                 // la URL ya tenía ?
    }

    return fetch(url, opciones).then(function(resp){
        // El servidor responde 301 si el token falta, es incorrecto o ha expirado
        if (resp.status == 301 && token != null){
            alert("La sesión ha caducado, vuelve a entrar");
            salir();
        }
        return resp;
    });
}

/* ===============================
   CAMBIO DE SECCIONES
================================ */
function cambiarSeccion(seccion){
    document.getElementById(seccionActual).classList.remove("activa");
    document.getElementById(seccion).classList.add("activa");
    seccionActual = seccion;
}

/* ===============================
   LOGIN
================================ */
async function entrar(){
    const usuario = document.getElementById("usuario").value;
    const password = document.getElementById("password").value;

    const resp = await fetchToken('/api/gestores/login',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({login: usuario, password})
    });

    if(!resp.ok){
        alert("Usuario o contraseña incorrectos");
        return;
    }

    const data = await resp.json(); // data = { id: 3, token: "eyJ0eX..." }
    idGestor = data.id;
    token = data.token;   // P3 - PARTE 2: guardamos el token

    await cargarMenuPrincipal();
    cambiarSeccion("menu-principal");
}

/* ===============================
   REGISTRO / MODIFICAR GESTOR
================================ */
async function guardarGestor(isNuevo){
    const datos = {
        nombre: document.getElementById("nombre").value,
        apellidos: document.getElementById("apellidos").value,
        usuario: document.getElementById("loginG").value,
        password: document.getElementById("passwordG").value
    };

    const url = isNuevo ? '/api/gestores' : `/api/gestores/${idGestor}`;
    const method = isNuevo ? 'POST' : 'PUT';

    const resp = await fetchToken(url,{
        method,
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(datos)
    });

    if(resp.ok){
        alert(isNuevo ? "Registro correcto" : "Datos actualizados");
        cambiarSeccion(isNuevo ? "login" : "menu-principal");
    } else {
        alert(await resp.json());
    }
}

async function editarGestor(){
    const resp = await fetchToken(`/api/gestores/${idGestor}`);
    const data = await resp.json();

    document.getElementById("nombre").value = data.nombre;
    document.getElementById("apellidos").value = data.apellidos;
    document.getElementById("loginG").value = data.usuario;
    document.getElementById("passwordG").value = "";

    cambiarSeccion("registro-gestor");
}

function salir(){
    idGestor = null;
    token = null;   // P3 - PARTE 2: al salir se borra el token
    cambiarSeccion("login");
}

/* ===============================
   CARGA INICIAL DEL MENÚ
================================ */
async function cargarMenuPrincipal(){
    await cargarFiltros();
    await buscarRecursos();
    cargarRanking();   // PRÁCTICA 3 - PARTE 1: el ranking sale en la vista principal
}

/* ===============================
   CARGAR FILTROS (UNA SOLA VEZ)
================================ */
async function cargarFiltros(){
    const [catRes, modRes, ubiRes] = await Promise.all([
        fetchToken('/api/categorias').then(r=>r.json()),
        fetchToken('/api/modelos').then(r=>r.json()),
        fetchToken('/api/ubicaciones').then(r=>r.json())
    ]);

    const selCat = document.getElementById("filtroCategoria");
    selCat.innerHTML = '<option value="Todos">Todos</option>';
    catRes.forEach(c => selCat.innerHTML += `<option value="${c.id}">${c.nombre}</option>`);

    const selMod = document.getElementById("filtroModelo");
    selMod.innerHTML = '<option value="Todos">Todos</option>';
    modRes.forEach(m => selMod.innerHTML += `<option value="${m.id}">${m.nombre}</option>`);

    const selUbi = document.getElementById("filtroUbicacion");
    selUbi.innerHTML = '<option value="Todos">Todos</option>';
    ubiRes.forEach(u => selUbi.innerHTML += `<option value="${u.id}">${u.nombre}</option>`);
}



/* ===============================
   BUSCAR RECURSOS (BOTÓN BUSCAR)
================================ */
async function buscarRecursos(){// primero se recoge los valores de los filtros que el usuario ha seleccionado en la interfaz, esos filtros se usan para construir la URL que pedirá los datos al servidor son los <select> del HTML 
    const mod = document.getElementById("filtroModelo").value;
    const cat = document.getElementById("filtroCategoria").value;
    const ubi = document.getElementById("filtroUbicacion").value;
    const estado = document.getElementById("filtroEstado").value;

    let url = '/api/recursos?';// se construye la URL para llamar al servidor con filtros opcionales, si el filtro es Todos no se añade nada, pq se devuelve todo sin filtrar
    if(cat !== 'Todos') url += `categoria=${cat}&`;
    if(mod !== 'Todos') url += `modelo=${mod}&`;
    if(ubi !== 'Todos') url += `ubicacion=${ubi}&`;
    if(estado !== 'Todos') url += `estado=${estado}&`;

    const [recursos, catRes, modRes, ubiRes] = await Promise.all([ // llamadas al servidor, fetch es una funcion que permite hacer peticiones HTTP desde el navegador y luego convertimos HTTP a json
        fetchToken(url).then(r=>r.json()),// devuelve array de recursos (ya filtrados segun URL)
        fetchToken('/api/categorias').then(r=>r.json()),// array con todas las categorias
        fetchToken('/api/modelos').then(r=>r.json()),
        fetchToken('/api/ubicaciones').then(r=>r.json())
    ]);

    const tabla = document.getElementById("tablaRecursos");// limpiar la tabla antes de llenarla para que no se acumulen filas de búsquedas anteriores
    tabla.innerHTML = "";
    tabla.innerHTML = "";

    // recorrer los recursos y generar filas
    recursos.forEach(r=>{// array recursos, resultado del fetch, array que devuelve el servidor (ya filtrado si se aplicaron filtros)
        const modeloObj = modRes.find(m => m.id === r.modelo);// son arrays DISTINTOS, mirar datos.js, busca modelo cuyo id coincida con el del recurso
        const categoriaObj = modeloObj ? catRes.find(c => c.id === modeloObj.categoria) : null;
        const ubicacionObj = ubiRes.find(u => u.id === r.ubicacion);

        // convertir estado numérico en texto
        let estadoTexto = "";
        if(r.estado === 0) estadoTexto = "Operativo";
        if(r.estado === 1) estadoTexto = "En mantenimiento";
        if(r.estado === 2) estadoTexto = "Desactivado";

        const fila = document.createElement("tr");
        fila.innerHTML = `
            <td>${r.numero_serie}</td>
            <td>${categoriaObj ? categoriaObj.nombre : ''}</td>
            <td>${modeloObj ? modeloObj.nombre : ''}</td>
            <td>${ubicacionObj ? ubicacionObj.nombre : ''}</td>
            <td>${estadoTexto}</td>
            <td><button onclick="abrirRecurso(${r.id})">Abrir</button></td>
            <td><button onclick="borrarRecurso(${r.id})">X</button></td>
        `;
        tabla.appendChild(fila);
    });
}

/* ===============================
   ABRIR RECURSO
================================ */
async function abrirRecurso(id){
    recursoActual = id;

    const [res, cats, mods, ubis, resv, resen] = await Promise.all([
        fetchToken(`/api/recursos/${id}`).then(r=>r.json()),
        fetchToken('/api/categorias').then(r=>r.json()),
        fetchToken('/api/modelos').then(r=>r.json()),
        fetchToken('/api/ubicaciones').then(r=>r.json()),
        fetchToken(`/api/recursos/${id}/reservas`).then(r=>r.json()),
        fetchToken(`/api/recursos/${id}/resenyas`).then(r=>r.json())
    ]);

    const selCat = document.getElementById("recursoCategoria");
    selCat.innerHTML = "";
    cats.forEach(c => selCat.innerHTML += `<option value="${c.id}">${c.nombre}</option>`);

    const selMod = document.getElementById("recursoModelo");
    selMod.innerHTML = "";
    mods.forEach(m => selMod.innerHTML += `<option value="${m.id}" ${m.id===res.modelo?'selected':''}>${m.nombre}</option>`);

    const selUbi = document.getElementById("recursoUbicacion");
    selUbi.innerHTML = "";
    ubis.forEach(u => selUbi.innerHTML += `<option value="${u.id}" ${u.id===res.ubicacion?'selected':''}>${u.nombre}</option>`);

    document.getElementById("recursoSerie").value = res.numero_serie;
    document.getElementById("recursoEstado").value = res.estado;

    const tablaR = document.getElementById("tablaReservas");
    tablaR.innerHTML = "";
    resv.forEach(r=>{
        const fila = document.createElement("tr");
        fila.innerHTML = `
            <td>${r.sanitario}</td>
            <td>${r.horas_estimadas}</td>
            <td>${new Date(r.fecha_peticion).toLocaleString()}</td>
            <td>${r.fecha_inicio ? new Date(r.fecha_inicio).toLocaleString() : ''}</td>
            <td>${r.fecha_fin ? new Date(r.fecha_fin).toLocaleString() : ''}</td>
        `;
        fila.className = colorReserva(r);
        tablaR.appendChild(fila);
    });

    const tablaRes = document.getElementById("tablaResenyas");
    tablaRes.innerHTML = "";
    resen.forEach(r=>{
        tablaRes.innerHTML += `
            <tr>
                <td>${new Date(r.fecha).toLocaleString()}</td>
                <td>${r.sanitario}</td>
                <td>${r.valor}</td>
                <td>${r.descripcion}</td>
            </tr>`;
    });

    cambiarSeccion("recurso-detalle");
}

/* ===============================
   COLORES RESERVAS 
================================ */
function colorReserva(r){ 
    const ahora = new Date();
    if(r.fecha_fin) return 'reserva-finalizada';
    
    if(r.fecha_inicio){
        // IMPORTANTE: Convertimos el string que viene del servidor a objeto Date
        const fechaInicioObj = new Date(r.fecha_inicio);
        
        // Calcular el tiempo de fin estimado
        const finEstimada = new Date(fechaInicioObj.getTime() + (r.horas_estimadas * 60 * 60 * 1000));
        
        return ahora > finEstimada ? 'reserva-superada' : 'reserva-en-uso';
    }
    return 'reserva-pendiente';
}

/* ===============================
   BORRAR / NUEVO / GUARDAR RECURSO
================================ */
async function borrarRecurso(id){
    if(confirm("¿Borrar recurso?")){
        const resp = await fetchToken(`/api/recursos/${id}`, {method:'DELETE'});
        if(resp.ok) buscarRecursos();
    }
}

function nuevoRecurso(){
    recursoActual = null;
    document.getElementById("recursoSerie").value = '';
    cargarOpcionesFicha();
    cambiarSeccion("recurso-detalle");
}

async function guardarRecurso(){
    const data = {
        modelo: parseInt(document.getElementById("recursoModelo").value),
        ubicacion: parseInt(document.getElementById("recursoUbicacion").value),
        numero_serie: document.getElementById("recursoSerie").value,
        estado: parseInt(document.getElementById("recursoEstado").value)
    };

    if(recursoActual){
        await fetchToken(`/api/recursos/${recursoActual}`,{
            method:'PUT',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify(data)
        });
    } else {
        await fetchToken('/api/recursos',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify(data)
        });
    }

    await buscarRecursos();
    cambiarSeccion("menu-principal");
}

async function cargarOpcionesFicha(){
    const [cats, mods, ubis] = await Promise.all([
        fetchToken('/api/categorias').then(r=>r.json()),
        fetchToken('/api/modelos').then(r=>r.json()),
        fetchToken('/api/ubicaciones').then(r=>r.json())
    ]);

    document.getElementById("recursoCategoria").innerHTML =
        cats.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join("");

    document.getElementById("recursoModelo").innerHTML =
        mods.map(m=>`<option value="${m.id}">${m.nombre}</option>`).join("");

    document.getElementById("recursoUbicacion").innerHTML =
        ubis.map(u=>`<option value="${u.id}">${u.nombre}</option>`).join("");
}

/* =========================================================
   PRÁCTICA 3 - PARTE 1: INTEGRACIÓN CON EL MINISTERIO
   - subirReservasMinisterio(): muchos GET a NUESTRO servidor
     + un POST al servidor del Ministerio
   - cargarRanking(): un GET al Ministerio, se COMPRUEBA todo
     lo que llega y se hace el ranking por área médica
========================================================= */

// URL del servicio del Ministerio 
var URL_MINISTERIO = "https://undefined.ua.es/telemedicina/api/datos";

// con el códigodistinguimos nuestros envíos

var MI_ID_AREA = 1;


var AREAS = ["",
    "Alergología", "Anestesiología", "Cardiología", "Cirugía General",
    "Dermatología", "Aparato Digestivo", "Endocrinología", "Ginecología",
    "Hematología", "Medicina Interna", "Neumología", "Neurología",
    "Oftalmología", "Oncología", "Pediatría", "Psiquiatría",
    "Traumatología", "Urología"];

// formato YYYY-MM-DD
function fechaHoy(){
    var d = new Date();
    var mes = String(d.getMonth() + 1).padStart(2, "0");
    var dia = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mes + "-" + dia;
}

/* ---------- BOTÓN: SUBIR RESERVAS (POST) ---------- */
async function subirReservasMinisterio(soloFinalizadas){
    var idArea = MI_ID_AREA;

    try {
        // 1) Pedimos a NUESTRO servidor todo lo necesario (con token)
        var reservas   = await fetchToken('/api/reservas').then(r => r.json());
        var sanitarios = await fetchToken('/api/sanitarios').then(r => r.json());
        var recursos   = await fetchToken('/api/recursos').then(r => r.json());
        var modelos    = await fetchToken('/api/modelos').then(r => r.json());
        var categorias = await fetchToken('/api/categorias').then(r => r.json());

        // 2) Montamos un objeto por cada reserva con el formato del Ministerio
        var datos = [];// datos es el objeto con todo
        for (var i = 0; i < reservas.length; i++){
            var r = reservas[i];

            // EJ1 : si solo queremos las finalizadas, SALTAMOS las que no tienen fecha de fin
            if(soloFinalizadas == true && r.fecha_fin == null ){
                continue;
            }

            // sanitario de la reserva
            var san = null;
            for (var j = 0; j < sanitarios.length; j++){
                if (sanitarios[j].id == r.sanitario) san = sanitarios[j];
            }
            // recurso -> modelo -> categoría
            var rec = null;
            for (var j = 0; j < recursos.length; j++){
                if (recursos[j].id == r.recurso) rec = recursos[j];
            }
            var mod = null;
            if (rec != null){
                for (var j = 0; j < modelos.length; j++){
                    if (modelos[j].id == rec.modelo) mod = modelos[j];
                }
            }
            var cat = null;
            if (mod != null){
                for (var j = 0; j < categorias.length; j++){
                    if (categorias[j].id == mod.categoria) cat = categorias[j];
                }
            }

            datos.push({
                "nombre":          san ? san.nombre : "",
                "apellidos":       san ? san.apellidos : "",
                "categoría":       cat ? cat.nombre : "",
                "horas_estimadas": r.horas_estimadas,
                "fec_pet":         r.fecha_peticion,
                "fec_ini":         r.fecha_inicio,
                "fecha_fin":       r.fecha_fin
            });
        }

        // 3) POST al Ministerio (SIN nuestro token: es otro servidor)
        var cuerpo = { "id_area": idArea, "fecha": fechaHoy(), "datos": datos };

        var resp = await fetch(URL_MINISTERIO, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo)
        });

        if (!resp.ok){
            alert("El Ministerio ha rechazado los datos (error " + resp.status + ")");
            return;
        }
        alert("Subidas " + datos.length + " reservas al Ministerio (código " + idArea + ")");
        cargarRanking();

    } catch (e){
        console.log(e);
        alert("No se ha podido conectar con el Ministerio");
    }
}






/* ---------- COMPROBACIONES (no fiarse de lo que suben otros grupos) ---------- */

// ¿Está bien un ENVÍO?   { id_area: 1..18, fecha: "...", datos: [ ... ] }
function esEnvioValido(envio){
    // 1) Tiene que ser un objeto { } (no null, no número, no texto, no array)
    if (envio == null) return false;
    if (typeof envio != "object") return false;
    if (Array.isArray(envio)) return false;

    // 2) id_area tiene que ser un número entero del 1 al 18
    if (typeof envio.id_area != "number" && typeof envio.id_area != "string") return false;
    var area = Number(envio.id_area);
    if (isNaN(area)) return false;            // no es un número
    if (area < 1 || area > 18) return false;  // fuera de rango
    if (area % 1 != 0) return false;          // tiene decimales (ej: 2.5)

    // 3) datos tiene que ser un array [ ]
    if (!Array.isArray(envio.datos)) return false;

    return true;   // ha pasado todas las comprobaciones
}

// ¿Está bien una RESERVA de dentro de "datos"?
function esReservaValida(r){
    // 1) Tiene que ser un objeto { }
    if (r == null) return false;
    if (typeof r != "object") return false;
    if (Array.isArray(r)) return false;

    // 2) nombre: texto, no vacío, y que NO sea un número (por si pusieron el id)
    if (typeof r.nombre != "string") return false;
    if (r.nombre.trim() == "") return false;
    if (!isNaN(r.nombre)) return false;       // "3" es un número -> mal

    // 3) apellidos: lo mismo
    if (typeof r.apellidos != "string") return false;
    if (r.apellidos.trim() == "") return false;
    if (!isNaN(r.apellidos)) return false;

    // 4) categoría: lo mismo (puede venir con tilde o sin ella)
    var categoria = r["categoría"];
    if (categoria == undefined) categoria = r["categoria"];
    if (typeof categoria != "string") return false;
    if (categoria.trim() == "") return false;
    if (!isNaN(categoria)) return false;

    // 5) horas_estimadas: un número mayor que 0
    if (typeof r.horas_estimadas != "number" && typeof r.horas_estimadas != "string") return false;
    var horas = Number(r.horas_estimadas);
    if (isNaN(horas)) return false;
    if (horas <= 0) return false;

    // 6) fec_pet: obligatoria y tiene que ser una fecha de verdad
    if (r.fec_pet == null) return false;
    if (isNaN(new Date(r.fec_pet).getTime())) return false;   // "Invalid Date" -> mal

    // 7) fec_ini y fecha_fin: pueden ser null (sin empezar / sin acabar),
    //    pero si traen algo, tiene que ser una fecha de verdad
    if (r.fec_ini != null && isNaN(new Date(r.fec_ini).getTime())) return false;
    if (r.fecha_fin != null && isNaN(new Date(r.fecha_fin).getTime())) return false;

    return true;   // ha pasado todas las comprobaciones
}







/* ---------- RANKING (GET) ---------- */
/* ---------- RANKING POR ÁREA (GET) ---------- */
async function cargarRanking(){
    var tabla = document.getElementById("tablaRanking");
    tabla.innerHTML = "<tr><td colspan='3'>Cargando...</td></tr>";

    try {
        // 1) GET al Ministerio (SIN token, es otro servidor)
        var resp = await fetch(URL_MINISTERIO);
        if (!resp.ok){
            tabla.innerHTML = "<tr><td colspan='3'>Error al pedir los datos al Ministerio</td></tr>";
            return;
        }

        // envios = la lista de TODOS los envíos que han subido todos los grupos
        var envios = await resp.json();

        // si no es una lista [ ], no podemos hacer nada
        if (!Array.isArray(envios)){
            tabla.innerHTML = "<tr><td colspan='3'>El Ministerio ha devuelto datos incorrectos</td></tr>";
            return;
        }

        // 2) ranking = lista de { area, total }   ej: [ {area: 1, total: 24}, {area: 6, total: 12} ]
        var ranking = [];

        // Recorro cada ENVÍO
        for (var i = 0; i < envios.length; i++){
            var envio = envios[i];                 // un envío: { id_area, fecha, datos: [...] }

            if (!esEnvioValido(envio)){            // si el envío está mal, lo salto
                continue;
            }
            var area = Number(envio.id_area);

            // Recorro cada RESERVA de ese envío
            for (var j = 0; j < envio.datos.length; j++){
                var r = envio.datos[j];            // una reserva: { nombre, apellidos, categoría, ... }

                if (!esReservaValida(r)){          // si la reserva está mal, la salto
                    continue;
                }

                // recorro la lista y si encuentro ese area 
                // cambio la posicion por el nº donde esta
                var posicion = -1;
                for (var k = 0; k < ranking.length; k++){
                    if (ranking[k].area == area){
                        posicion = k;
                    }
                }

                if (posicion == -1){
                    // no estaba: la añado con 1 reserva
                    ranking.push({ area: area, total: 1 });
                } else {
                    // ya estaba: le sumo 1 
                    ranking[posicion].total = ranking[posicion].total + 1;
                }
            }
        }

        // 3) Ordenar de MAYOR a MENOR total
        //    (comparo de dos en dos y, si están al revés, los intercambio)
        for (var a = 0; a < ranking.length; a++){
            for (var b = a + 1; b < ranking.length; b++){
                if (ranking[b].total > ranking[a].total){
                    var aux = ranking[a];
                    ranking[a] = ranking[b];
                    ranking[b] = aux;
                }
            }
        }

        // 4) Pintar la tabla
        tabla.innerHTML = "";
        if (ranking.length == 0){
            tabla.innerHTML = "<tr><td colspan='3'>Todavía no hay datos válidos</td></tr>";
            return;
        }
        for (var i = 0; i < ranking.length; i++){
            var nombre = AREAS[ranking[i].area];                 // ej: AREAS[1] = "Alergología"
            if (ranking[i].area == MI_ID_AREA){
                nombre = nombre + " (nosotros)";
            }
            tabla.innerHTML = tabla.innerHTML +
                "<tr><td>" + (i + 1) + "º</td>" +
                "<td>" + nombre + " (" + ranking[i].area + ")</td>" +
                "<td>" + ranking[i].total + "</td></tr>";
        }

    } catch (e){
        console.log(e);
        tabla.innerHTML = "<tr><td colspan='3'>No se ha podido conectar con el Ministerio</td></tr>";
    }
}


/* ---------- EJERCICIO 3: RANKING POR CATEGORÍA ---------- */
async function cargarRankingCategoria(){
    var tabla = document.getElementById("tablaRankingCategoria");
    tabla.innerHTML = "<tr><td colspan='3'>Cargando...</td></tr>";

    try {
        // 1) GET al Ministerio (SIN token)
        var resp = await fetch(URL_MINISTERIO);
        if (!resp.ok){
            tabla.innerHTML = "<tr><td colspan='3'>Error al pedir los datos al Ministerio</td></tr>";
            return;
        }
        var envios = await resp.json();
        if (!Array.isArray(envios)){ // si envios NO es una lista:
            tabla.innerHTML = "<tr><td colspan='3'>El Ministerio ha devuelto datos incorrectos</td></tr>";
            return;
        }

        // 2) ranking = lista de { categoria, total }   
        var ranking = [];

        for (var i = 0; i < envios.length; i++){
            var envio = envios[i];
            if (!esEnvioValido(envio)){
                continue;
            }

            for (var j = 0; j < envio.datos.length; j++){
                var r = envio.datos[j];
                if (!esReservaValida(r)){
                    continue;
                }

                // la categoría puede venir con o sin tilde
                var categoria = r["categoría"];
                if (categoria == undefined){
                    categoria = r["categoria"];
                }

                // ¿Ya tengo esta categoría en el ranking? La busco
                var posicion = -1;

                for (var k = 0; k < ranking.length; k++){
                    if (ranking[k].categoria == categoria){
                        posicion = k;
                    }
                }

                // total es cuantas reservas hay de esa categoria
                if (posicion == -1){
                    ranking.push({ categoria: categoria, total: 1 });
                } else {
                    ranking[posicion].total = ranking[posicion].total + 1;
                }
            }
        }

        // 3) Ordenar de MAYOR a MENOR total
        for (var a = 0; a < ranking.length; a++){
            for (var b = a + 1; b < ranking.length; b++){
                if (ranking[b].total > ranking[a].total){
                    var aux = ranking[a];
                    ranking[a] = ranking[b];
                    ranking[b] = aux;
                }
            }
        }

        // 4) Pintar la tabla
        tabla.innerHTML = "";
        if (ranking.length == 0){
            tabla.innerHTML = "<tr><td colspan='3'>Todavía no hay datos válidos</td></tr>";
            return;
        }
        for (var i = 0; i < ranking.length; i++){
            tabla.innerHTML = tabla.innerHTML +
                "<tr><td>" + (i + 1) + "º</td>" +
                "<td>" + ranking[i].categoria + "</td>" +
                "<td>" + ranking[i].total + "</td></tr>";
        }

    } catch (e){
        console.log(e);
        tabla.innerHTML = "<tr><td colspan='3'>No se ha podido conectar con el Ministerio</td></tr>";
    }
}
