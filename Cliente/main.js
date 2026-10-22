let seccionActual = "login";
let idGestor = null;
let recursoActual = null;

let token = null;

/* ===============================
   FETCH CON TOKEN
================================ */
function fetchToken(url, opciones){
    if (token != null){
        if (url.indexOf("?") == -1) url = url + "?token=" + token;
        else if (url.endsWith("?") || url.endsWith("&")) url = url + "token=" + token;
        else url = url + "&token=" + token;
    }

    return fetch(url, opciones).then(function(resp){
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

    const data = await resp.json();
    idGestor = data.id;
    token = data.token;

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
    token = null;
    cambiarSeccion("login");
}

/* ===============================
   CARGA INICIAL DEL MENÚ
================================ */
async function cargarMenuPrincipal(){
    await cargarFiltros();
    await buscarRecursos();
    cargarRanking();
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
async function buscarRecursos(){
    const mod = document.getElementById("filtroModelo").value;
    const cat = document.getElementById("filtroCategoria").value;
    const ubi = document.getElementById("filtroUbicacion").value;
    const estado = document.getElementById("filtroEstado").value;

    let url = '/api/recursos?';
    if(cat !== 'Todos') url += `categoria=${cat}&`;
    if(mod !== 'Todos') url += `modelo=${mod}&`;
    if(ubi !== 'Todos') url += `ubicacion=${ubi}&`;
    if(estado !== 'Todos') url += `estado=${estado}&`;

    const [recursos, catRes, modRes, ubiRes] = await Promise.all([
        fetchToken(url).then(r=>r.json()),
        fetchToken('/api/categorias').then(r=>r.json()),
        fetchToken('/api/modelos').then(r=>r.json()),
        fetchToken('/api/ubicaciones').then(r=>r.json())
    ]);

    const tabla = document.getElementById("tablaRecursos");
    tabla.innerHTML = "";

    recursos.forEach(r=>{
        const modeloObj = modRes.find(m => m.id === r.modelo);
        const categoriaObj = modeloObj ? catRes.find(c => c.id === modeloObj.categoria) : null;
        const ubicacionObj = ubiRes.find(u => u.id === r.ubicacion);

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
        const fechaInicioObj = new Date(r.fecha_inicio);
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

/* ===============================
   MINISTERIO
================================ */
var URL_MINISTERIO = "https://undefined.ua.es/telemedicina/api/datos";

var MI_ID_AREA = 1;

var AREAS = ["",
    "Alergología", "Anestesiología", "Cardiología", "Cirugía General",
    "Dermatología", "Aparato Digestivo", "Endocrinología", "Ginecología",
    "Hematología", "Medicina Interna", "Neumología", "Neurología",
    "Oftalmología", "Oncología", "Pediatría", "Psiquiatría",
    "Traumatología", "Urología"];

// YYYY-MM-DD
function fechaHoy(){
    var d = new Date();
    var mes = String(d.getMonth() + 1).padStart(2, "0");
    var dia = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mes + "-" + dia;
}

/* ===============================
   SUBIR RESERVAS (POST)
================================ */
// "DNI" de una reserva para saber si ya está en el Ministerio
function claveReserva(nombre, apellidos, categoria, horas, fecPet){
    return nombre + "|" + apellidos + "|" + categoria + "|" + Number(horas) + "|" + String(fecPet).substring(0, 10);
}

async function subirReservasMinisterio(){
    var idArea = MI_ID_AREA;

    try {
        // Reservas que ya están en el Ministerio con nuestro código
        var respMin = await fetch(URL_MINISTERIO);
        var enviosMin = await respMin.json();

        var yaSubidas = [];
        for (var i = 0; i < enviosMin.length; i++){
            var envio = enviosMin[i];
            if (envio == null || Number(envio.id_area) != MI_ID_AREA) continue;
            if (!Array.isArray(envio.datos)) continue;

            for (var j = 0; j < envio.datos.length; j++){
                var d = envio.datos[j];
                if (d == null) continue;
                yaSubidas.push(claveReserva(d.nombre, d.apellidos, sacarCategoria(d), d.horas_estimadas, d.fec_pet));
            }
        }

        // Datos de nuestro servidor
        var reservas   = await fetchToken('/api/reservas').then(r => r.json());
        var sanitarios = await fetchToken('/api/sanitarios').then(r => r.json());
        var recursos   = await fetchToken('/api/recursos').then(r => r.json());
        var modelos    = await fetchToken('/api/modelos').then(r => r.json());
        var categorias = await fetchToken('/api/categorias').then(r => r.json());

        var datos = [];
        for (var i = 0; i < reservas.length; i++){
            var r = reservas[i];

            var san = null;
            for (var j = 0; j < sanitarios.length; j++){
                if (sanitarios[j].id == r.sanitario) san = sanitarios[j];
            }
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

            var nombre    = "";
            var apellidos = "";
            var categoria = "";
            if (san != null){
                nombre = san.nombre;
                apellidos = san.apellidos;
            }
            if (cat != null){
                categoria = cat.nombre;
            }

            // ¿Ya está subida? Entonces no la vuelvo a mandar
            var clave = claveReserva(nombre, apellidos, categoria, r.horas_estimadas, r.fecha_peticion);
            var repetida = false;
            for (var k = 0; k < yaSubidas.length; k++){
                if (yaSubidas[k] == clave){
                    repetida = true;
                }
            }
            if (repetida == true) continue;

            datos.push({
                "nombre":          nombre,
                "apellidos":       apellidos,
                "categoría":       categoria,
                "horas_estimadas": r.horas_estimadas,
                "fec_pet":         r.fecha_peticion,
                "fec_ini":         r.fecha_inicio,
                "fecha_fin":       r.fecha_fin
            });
        }

        if (datos.length == 0){
            alert("No hay reservas nuevas. Todas están ya subidas al Ministerio.");
            return;
        }

        // POST al Ministerio (solo las nuevas)
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
        alert("Subidas " + datos.length + " reservas nuevas al Ministerio (código " + idArea + ")");
        cargarRanking();

    } catch (e){
        console.log(e);
        alert("No se ha podido conectar con el Ministerio");
    }
}

/* ===============================
   COMPROBACIONES
================================ */
function esTextoValido(t){
    if (typeof t != "string") return false;
    if (t.trim() == "") return false;
    if (!isNaN(t)) return false;
    return true;
}

function esFechaValida(f){
    if (typeof f != "string") return false;
    if (f.indexOf("-") == -1) return false;
    if (isNaN(new Date(f).getTime())) return false;

    var partes = f.substring(0, 10).split("-");
    if (partes.length != 3) return false;
    var anyo = Number(partes[0]);
    var mes  = Number(partes[1]);
    var dia  = Number(partes[2]);
    if (isNaN(anyo) || isNaN(mes) || isNaN(dia)) return false;

    if (anyo < 2000) return false;

    // ¿Existe ese día? (ej: 31 de febrero no)
    var prueba = new Date(anyo, mes - 1, dia);
    if (prueba.getMonth() != mes - 1) return false;
    if (prueba.getDate() != dia) return false;

    return true;
}

function esFechaVacia(f){
    if (f == null) return true;
    if (f === "") return true;
    return false;
}

// Con tilde o sin ella
function sacarCategoria(r){
    var categoria = r["categoría"];
    if (categoria == undefined){
        categoria = r["categoria"];
    }
    return categoria;
}

function esEnvioValido(envio){
    if (envio == null) return false;
    if (typeof envio != "object") return false;
    if (Array.isArray(envio)) return false;

    // id_area entero del 1 al 18
    if (typeof envio.id_area != "number" && typeof envio.id_area != "string") return false;
    var area = Number(envio.id_area);
    if (isNaN(area)) return false;
    if (area < 1 || area > 18) return false;
    if (area % 1 != 0) return false;

    if (!esFechaValida(envio.fecha)) return false;

    if (!Array.isArray(envio.datos)) return false;

    return true;
}

function esReservaValida(r){
    if (r == null) return false;
    if (typeof r != "object") return false;
    if (Array.isArray(r)) return false;

    if (!esTextoValido(r.nombre)) return false;
    if (!esTextoValido(r.apellidos)) return false;
    if (!esTextoValido(sacarCategoria(r))) return false;

    // horas: número mayor que 0 (5 o "5")
    if (typeof r.horas_estimadas != "number" && typeof r.horas_estimadas != "string") return false;
    var horas = Number(r.horas_estimadas);
    if (isNaN(horas)) return false;
    if (horas <= 0) return false;
    if (!isFinite(horas)) return false;

    // fec_pet obligatoria y no en el futuro (margen de 1 día por zona horaria)
    if (!esFechaValida(r.fec_pet)) return false;
    var UN_DIA = 24 * 60 * 60 * 1000;
    if (new Date(r.fec_pet).getTime() > Date.now() + UN_DIA) return false;

    // fec_ini y fecha_fin pueden estar vacías
    if (!esFechaVacia(r.fec_ini) && !esFechaValida(r.fec_ini)) return false;
    if (!esFechaVacia(r.fecha_fin) && !esFechaValida(r.fecha_fin)) return false;

    // Orden lógico: petición <= inicio <= fin
    if (!esFechaVacia(r.fec_ini) && new Date(r.fec_ini) < new Date(r.fec_pet)) return false;
    if (!esFechaVacia(r.fecha_fin) && esFechaVacia(r.fec_ini)) return false;
    if (!esFechaVacia(r.fecha_fin) && new Date(r.fecha_fin) < new Date(r.fec_ini)) return false;

    return true;
}

/* ===============================
   RANKING POR ÁREA (GET)
================================ */
async function cargarRanking(){
    var tabla = document.getElementById("tablaRanking");
    tabla.innerHTML = "<tr><td colspan='3'>Cargando...</td></tr>";

    try {
        var resp = await fetch(URL_MINISTERIO);
        if (!resp.ok){
            tabla.innerHTML = "<tr><td colspan='3'>Error al pedir los datos al Ministerio</td></tr>";
            return;
        }

        var envios = await resp.json();

        if (!Array.isArray(envios)){
            tabla.innerHTML = "<tr><td colspan='3'>El Ministerio ha devuelto datos incorrectos</td></tr>";
            return;
        }

        // ranking = [ {area, total}, ... ]
        var ranking = [];

        for (var i = 0; i < envios.length; i++){
            var envio = envios[i];

            if (!esEnvioValido(envio)){
                continue;
            }
            var area = Number(envio.id_area);

            for (var j = 0; j < envio.datos.length; j++){
                var r = envio.datos[j];

                if (!esReservaValida(r)){
                    continue;
                }

                var posicion = -1;
                for (var k = 0; k < ranking.length; k++){
                    if (ranking[k].area == area){
                        posicion = k;
                    }
                }

                if (posicion == -1){
                    ranking.push({ area: area, total: 1 });
                } else {
                    ranking[posicion].total = ranking[posicion].total + 1;
                }
            }
        }

        // Ordenar de mayor a menor
        for (var a = 0; a < ranking.length; a++){
            for (var b = a + 1; b < ranking.length; b++){
                if (ranking[b].total > ranking[a].total){
                    var aux = ranking[a];
                    ranking[a] = ranking[b];
                    ranking[b] = aux;
                }
            }
        }

        tabla.innerHTML = "";
        if (ranking.length == 0){
            tabla.innerHTML = "<tr><td colspan='3'>Todavía no hay datos válidos</td></tr>";
            return;
        }
        for (var i = 0; i < ranking.length; i++){
            var nombre = AREAS[ranking[i].area];
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