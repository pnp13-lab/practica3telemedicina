var express = require('express'); // cargar el módulo
var app = express(); // crear la app express

// =========================================================
// PRÁCTICA 3 - PARTE 3: BASE DE DATOS EN SUPABASE
// En vez de MySQL (XAMPP) usamos Supabase con su librería
// =========================================================
// 1. Importar el cliente de Supabase
const { createClient } = require('@supabase/supabase-js');

// 2. Configurar con tu URL y tu Public Key (anon key)
//    (Supabase -> botón "Connect" o Project Settings -> API)
const supabaseUrl = 'https://pnmoiqiivqsrqjnotfda.supabase.co';
const supabaseKey = 'sb_publishable_3fDuZl0SaLI0qhQ7BIeOhg_7ZuLBxsl';
const supabase = createClient(supabaseUrl, supabaseKey);

// PRÁCTICA 3 - PARTE 2: JWT
var jwt = require('jwt-simple');
var clave = 'miSecretoMasOscuro'; // clave para codificar / decodificar el token

app.use(express.json()); // json es un formato de intercambio de datos

// DEPURAR: mostrar todas las peticiones que llegan
app.use((req, res, next) => {
    console.log("Petición recibida:", req.method, req.path);
    next(); // sigue con la ruta correspondiente
});


// =========================================================
// SERVICIOS PÚBLICOS (no necesitan token)
// Login y registro tienen que ir ANTES del app.use que comprueba el token
// =========================================================

// POST: login gestor
app.post("/api/gestores/login", async function(req, res) {
    console.log("Intento de login:", req.body);
    var login = req.body.login;
    var password = req.body.password;

    // SELECT * FROM gestores WHERE usuario = login AND password = password
    const { data, error } = await supabase
        .from('gestores')
        .select('*')
        .eq('usuario', login)
        .eq('password', password);

    if (error) return res.status(500).json("Error en la base de datos");
    if (data.length === 0) return res.status(403).json("Usuario o contraseña incorrectos");

    console.log("Login correcto, id del gestor:", data[0].id);

    // el login crea el token
    var contenido = {
        usuario: data[0].id,
        expira: Date.now() + 60 * 60 * 1000 // expira en 1 hora (en ms)
    };
    var token = jwt.encode(contenido, clave);

    // devolvemos el token y también el id (la app del gestor lo usa para "Editar datos")
    res.status(200).json({ id: data[0].id, token: token });
});

// POST: CREAR UN NUEVO GESTOR (REGISTRO)
app.post("/api/gestores", async function(req, res) {
    console.log("Datos recibidos para nuevo gestor:", req.body);

    // ¿ya existe ese usuario?
    const { data: existentes, error: error1 } = await supabase
        .from('gestores')
        .select('id')
        .eq('usuario', req.body.usuario);

    if (error1) return res.status(500).json("Error en la base de datos");
    if (existentes.length > 0) return res.status(403).json("El usuario ya existe");

    // INSERT INTO gestores (nombre, apellidos, usuario, password) VALUES (...)
    const { error: error2 } = await supabase
        .from('gestores')
        .insert({
            nombre: req.body.nombre,
            apellidos: req.body.apellidos,
            usuario: req.body.usuario,
            password: req.body.password
        });

    if (error2) return res.status(500).json("Error al crear el gestor");
    res.status(201).json("Gestor creado correctamente");
});


// =========================================================
// COMPROBAR EL TOKEN ("el portero")
// Antes de este use, los servicios son públicos (no necesitan token)
// Después de este use, TODOS los /api necesitan el token
// El token llega en la URL:  /api/recursos?token=XXXXXXXX
// =========================================================
app.use("/api", function (req, res, next) {
    var token = req.query.token;
    // 1. mirar si hay token
    if (!token) {
        res.status(301).json("No se ha encontrado token");
        return;
    }

    // 2. mirar si es auténtico
    try {
        var contenidoToken = jwt.decode(token, clave); // abre el token con la clave
    } catch (error) { // es falso o está modificado
        res.status(301).json("El token es incorrecto");
        return;
    }
    console.log("El contenido del token es:", contenidoToken);

    // 3. mirar si tiene usuario y fecha de expiración
    if (!contenidoToken || !contenidoToken.expira || !contenidoToken.usuario) {
        res.status(301).json("El formato del token no es adecuado");
        return;
    }

    // 4. mirar si ha caducado
    if (contenidoToken.expira < Date.now()) {
        res.status(301).json("El token ha expirado");
        return;
    }

    // Todo ha ido bien: la petición llega al servicio pedido
    next();
});


// =========================================================
// SERVICIOS PROTEGIDOS (necesitan token)
// =========================================================

// GET ubicaciones
app.get("/api/ubicaciones", async function(req, res) {
    const { data, error } = await supabase.from('ubicaciones').select('*');
    if (error) return res.status(500).json("Error en la base de datos");
    res.status(200).json(data);
});

// GET categorias
app.get("/api/categorias", async function(req, res) {
    const { data, error } = await supabase.from('categorias').select('*');
    if (error) return res.status(500).json("Error en la base de datos");
    res.status(200).json(data);
});

// GET modelos
app.get("/api/modelos", async function(req, res) {
    const { data, error } = await supabase.from('modelos').select('*');
    if (error) return res.status(500).json("Error en la base de datos");
    res.status(200).json(data);
});

// PUT : ACTUALIZAR DATOS DE UN GESTOR
app.put("/api/gestores/:id", async function(req, res) {
    console.log("Datos para actualizar", req.body);
    var id = parseInt(req.params.id);

    // ¿existe el gestor?
    const { data: gestor, error: error1 } = await supabase
        .from('gestores')
        .select('id')
        .eq('id', id);
    if (error1) return res.status(500).json("Error en la base de datos");
    if (gestor.length === 0) return res.status(404).json("Gestor no encontrado");

    // si cambia el usuario, que no lo tenga otro gestor
    if (req.body.usuario) {
        const { data: otros, error: error2 } = await supabase
            .from('gestores')
            .select('id')
            .eq('usuario', req.body.usuario)
            .neq('id', id);
        if (error2) return res.status(500).json("Error en la base de datos");
        if (otros.length > 0) return res.status(403).json("Ese usuario ya existe");
    }

    // solo cambiamos los campos que vienen rellenos
    var cambios = {};
    if (req.body.nombre)    cambios.nombre = req.body.nombre;
    if (req.body.apellidos) cambios.apellidos = req.body.apellidos;
    if (req.body.usuario)   cambios.usuario = req.body.usuario;
    if (req.body.password)  cambios.password = req.body.password;

    const { error: error3 } = await supabase
        .from('gestores')
        .update(cambios)
        .eq('id', id);
    if (error3) return res.status(500).json("Error al actualizar el gestor");

    console.log("Gestor actualizado ID:", id);
    res.status(200).json("Gestor actualizado");
});

// GET : OBTENER DATOS DE UN GESTOR (SIN CONTRASEÑA)
app.get("/api/gestores/:id", async function(req, res) {
    var id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json("Id no válido");

    const { data, error } = await supabase
        .from('gestores')
        .select('id, nombre, apellidos, usuario')
        .eq('id', id);
    if (error) return res.status(500).json("Error en la base de datos");
    if (data.length === 0) return res.status(404).json("Gestor no encontrado");

    res.status(200).json(data[0]);
});

// GET : OBTENER LOS DATOS DE UN SANITARIO (SIN CONTRASEÑA)
app.get("/api/sanitarios/:id", async function(req, res) {
    var id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json("Id no válido");

    const { data, error } = await supabase
        .from('sanitarios')
        .select('id, nombre, apellidos, usuario')
        .eq('id', id);
    if (error) return res.status(500).json("Error en la base de datos");
    if (data.length === 0) return res.status(404).json("Sanitario no encontrado");

    res.status(200).json(data[0]);
});

// GET: OBTENER TODOS LOS RECURSOS (CON FILTROS OPCIONALES)
app.get("/api/recursos", async function(req, res) {
    var consulta = supabase.from('recursos').select('*');

    // filtro por categoría: la categoría está en la tabla modelos,
    // así que primero busco los modelos de esa categoría
    if (req.query.categoria) {
        const { data: modelos, error: errorModelos } = await supabase
            .from('modelos')
            .select('id')
            .eq('categoria', req.query.categoria);
        if (errorModelos) return res.status(500).json("Error en la base de datos");

        var idsModelos = [];
        for (var i = 0; i < modelos.length; i++) {
            idsModelos.push(modelos[i].id);
        }
        consulta = consulta.in('modelo', idsModelos);   // modelo IN (1, 2, ...)
    }

    if (req.query.modelo) {
        consulta = consulta.eq('modelo', req.query.modelo);
    }

    if (req.query.ubicacion) {
        consulta = consulta.eq('ubicacion', req.query.ubicacion);
    }

    if (req.query.estado != null && req.query.estado !== "") {
        consulta = consulta.eq('estado', req.query.estado);
    }

    const { data, error } = await consulta;
    if (error) {
        console.log("Error al filtrar recursos:", error);
        return res.status(500).json("Error en la base de datos");
    }
    res.status(200).json(data);
});

// GET : OBTIENE LOS DATOS DE UN RECURSO POR ID
app.get("/api/recursos/:id", async function(req, res) {
    var id = parseInt(req.params.id);

    const { data, error } = await supabase.from('recursos').select('*').eq('id', id);
    if (error) return res.status(500).json("Error en la base de datos");
    if (data.length === 0) return res.status(404).json("Recurso no encontrado");

    res.status(200).json(data[0]);
});

// POST : CREA UN RECURSO
app.post("/api/recursos", async function(req, res) {
    const { error } = await supabase
        .from('recursos')
        .insert({
            modelo: req.body.modelo,
            ubicacion: req.body.ubicacion,
            numero_serie: req.body.numero_serie,
            estado: req.body.estado
        });

    if (error) return res.status(500).json("Error al crear el recurso");
    res.status(201).json("Recurso creado");
});

// PUT : ACTUALIZA UN RECURSO
app.put("/api/recursos/:id", async function(req, res) {
    var recursoId = parseInt(req.params.id);

    // solo cambiamos los campos que vienen rellenos
    var cambios = {};
    if (req.body.modelo)       cambios.modelo = req.body.modelo;
    if (req.body.ubicacion)    cambios.ubicacion = req.body.ubicacion;
    if (req.body.numero_serie) cambios.numero_serie = req.body.numero_serie;
    if (req.body.estado != null) cambios.estado = req.body.estado;   // el estado puede ser 0

    const { data, error } = await supabase
        .from('recursos')
        .update(cambios)
        .eq('id', recursoId)
        .select();          // .select() para que devuelva las filas cambiadas
    if (error) return res.status(500).json("Error al actualizar el recurso");
    if (data.length === 0) return res.status(404).json("Recurso no encontrado");

    res.status(200).json("Recurso actualizado");
});

// DELETE : BORRA UN RECURSO
app.delete("/api/recursos/:id", async function(req, res) {
    var id = parseInt(req.params.id);

    const { data, error } = await supabase
        .from('recursos')
        .delete()
        .eq('id', id)
        .select();          // .select() para que devuelva las filas borradas
    if (error) return res.status(500).json("Error al borrar el recurso");
    if (data.length === 0) return res.status(404).json("Recurso no encontrado");

    res.status(200).json("Recurso borrado");
});

// GET: OBTIENE LAS RESERVAS DE UN RECURSO
app.get("/api/recursos/:id/reservas", async function(req, res) {
    var id = parseInt(req.params.id);

    const { data, error } = await supabase.from('reservas').select('*').eq('recurso', id);
    if (error) return res.status(500).json("Error en la base de datos");
    res.status(200).json(data);
});

// GET: OBTIENE LAS RESEÑAS DE UN RECURSO
app.get("/api/recursos/:id/resenyas", async function(req, res) {
    var id = parseInt(req.params.id);

    const { data, error } = await supabase.from('resenyas').select('*').eq('recurso', id);
    if (error) return res.status(500).json("Error en la base de datos");
    res.status(200).json(data);
});

// GET: Obtener todos los gestores
app.get("/api/gestores", async function(req, res) {
    const { data, error } = await supabase.from('gestores').select('id, nombre, apellidos, usuario');
    if (error) return res.status(500).json("Error en la base de datos");
    res.status(200).json(data);
});

// GET: Obtener todos los sanitarios
app.get("/api/sanitarios", async function(req, res) {
    const { data, error } = await supabase.from('sanitarios').select('id, nombre, apellidos, usuario');
    if (error) return res.status(500).json("Error en la base de datos");
    res.status(200).json(data);
});

// GET: Obtener todas las reservas
app.get("/api/reservas", async function(req, res) {
    const { data, error } = await supabase.from('reservas').select('*');
    if (error) return res.status(500).json("Error en la base de datos");
    res.status(200).json(data);
});

// GET: Obtener todas las reseñas
app.get("/api/resenyas", async function(req, res) {
    const { data, error } = await supabase.from('resenyas').select('*');
    if (error) return res.status(500).json("Error en la base de datos");
    res.status(200).json(data);
});

// Archivos de la web del gestor (index.html, main.js)
app.use(express.static(__dirname + "/Cliente"));

// PRÁCTICA 3 - PARTE 3: Render elige el puerto; en mi ordenador sigue siendo 3000
var PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, function(){
    console.log("Servidor arrancado en puerto " + PUERTO);
});
