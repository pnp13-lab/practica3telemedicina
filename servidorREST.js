var express = require('express'); // cargar el módulo
var app = express(); // crear la app express

// REQUERIR LA CONEXIÓN A MYSQL
var conexion = require('./conexion_mysql_2.js');

// PRÁCTICA 3 - PARTE 2
var jwt = require('jwt-simple');
var clave = 'miSecretoMasOscuro'; // clave para codificar / decodificar el token

app.use(express.json()); // json es un formato de intercambio de datos

// DEPURAR: mostrar todas las peticiones que llegan
app.use((req, res, next) => {
    console.log("Petición recibida:");
    next(); // sigue con la ruta correspondiente
});


// =========================================================
// PRÁCTICA 3 - PARTE 2: SERVICIOS PÚBLICOS (no necesitan token)
// Login y registro tienen que ir ANTES del app.use que comprueba el token
// =========================================================
// POST: login gestor
app.post("/api/gestores/login", function(req, res) {
    console.log("Intento de login:", req.body);
    var { login, password } = req.body;
    
    var sql = "SELECT * FROM gestores WHERE usuario = ? AND password = ?";
    conexion.query(sql, [login, password], function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");
        
        if (resultados.length === 0) {
            return res.status(403).json("Usuario o contraseña incorrectos");
        }
        
        console.log("Login correcto, id del gestor:", resultados[0].id);

        // PRÁCTICA 3 - PARTE 2: el login crea el  token
        var contenido = { // contenido del token
            usuario: resultados[0].id,
            expira: Date.now() + 60 * 60 * 1000 // en 1 hora en ms expira
        };
        var token = jwt.encode(contenido, clave); // crea token con clave

        // devolvemos el token y también el id (la app del gestor lo usa para "Editar datos")
        res.status(200).json({ id: resultados[0].id, token: token });
    });
});

// POST: CREAR UN NUEVO GESTOR (REGISTRO)
app.post("/api/gestores", function(req, res) {
    console.log("Datos recibidos para nuevo gestor:", req.body);

    var sqlCheck = "SELECT * FROM gestores WHERE usuario = ?";
    conexion.query(sqlCheck, [req.body.usuario], function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");

        if (resultados.length > 0) {
            return res.status(403).json("El usuario ya existe");
        }

        var sqlInsert = "INSERT INTO gestores (nombre, apellidos, usuario, password) VALUES (?, ?, ?, ?)";
        var valores = [req.body.nombre, req.body.apellidos, req.body.usuario, req.body.password];

        conexion.query(sqlInsert, valores, function(err, resultado) {
            if (err) return res.status(500).json("Error al crear el gestor");
            res.status(201).json("Gestor creado correctamente");
        });
    });
});

// =========================================================
// PRÁCTICA 3 - PARTE 2: COMPROBAR EL TOKEN ("el portero")
// Antes de este use, los servicios son públicos (no necesitan token)
// Después de este use, TODOS los /api necesitan el token
// El token llega en la URL:  /api/recursos?token=XXXXXXXX
// =========================================================

app.use("/api", function (req, res, next) {// para cualquier petición que empiece por /api
    var token = req.query.token;
    //1. mirar si hay token 
    if (!token) { // no se ha pasado un token
        res.status(301).json("No se ha encontrado token");
        return;
    }

    //2. mirar si es autentico
    try { // capturamos el error por si el token no es correcto
        var contenidoToken = jwt.decode(token, clave);// abre el token con cla clave
    } catch (error) { // es falso o esta modificado
        res.status(301).json("El token es incorrecto");
        return;
    }
    console.log("El contenido del token es:", contenidoToken);

    //mirar si  tiene usuario y fecha de expiracion
    if (!contenidoToken || !contenidoToken.expira || !contenidoToken.usuario) {
        res.status(301).json("El formato del token no es adecuado");
        return;
    }

    // mirar si ha caducado
    if (contenidoToken.expira < Date.now()) {
        res.status(301).json("El token ha expirado");
        return;
    }

    // Todo ha ido bien: la petición llega al  servicio pedido
    next();
});

//GET ubicaciones
app.get("/api/ubicaciones", function(req, res) {
    console.log("--> LLEGÓ PETICIÓN A UBICACIONES <--");
    conexion.query("SELECT * FROM ubicaciones", function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");
        res.status(200).json(resultados);
    });
});

//GET categorias
app.get("/api/categorias", function(req, res) {
    conexion.query("SELECT * FROM categorias", function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");
        res.status(200).json(resultados);
    });
});

// GET modelos
app.get("/api/modelos", function(req, res) {
    conexion.query("SELECT * FROM modelos", function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");
        res.status(200).json(resultados);
    });
});

// --- HOSPITALES Y MÉDICOS ---

// GET: Obtener todos los hospitales
app.get("/api/hospitales", function(req, res) {
    console.log("¡Se ha pedido la ruta de hospitales!");
    conexion.query("SELECT * FROM hospitales", function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");
        res.status(200).json(resultados);
    });
});

// GET: Obtener un hospital por ID
app.get("/api/hospitales/:id", function(req, res) {
    var id = parseInt(req.params.id);
    conexion.query("SELECT * FROM hospitales WHERE id = ?", [id], function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");
        if (resultados.length === 0) return res.status(404).json("Hospital no encontrado");
        res.status(200).json(resultados[0]);
    });
});

// GET: Obtener todos los médicos
app.get("/api/medicos", function(req, res) {
    conexion.query("SELECT * FROM medicos", function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");
        res.status(200).json(resultados);
    });
});

// GET: Obtener un médico por ID
app.get("/api/medicos/:id", function(req, res) {
    var id = parseInt(req.params.id);
    conexion.query("SELECT * FROM medicos WHERE id = ?", [id], function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");
        if (resultados.length === 0) return res.status(404).json("Médico no encontrado");
        res.status(200).json(resultados[0]);
    });
});

// PUT : ACTUALIZAR DATOS DE UN GESTOR 
app.put("/api/gestores/:id", function(req, res) {
    console.log("Datos para actualizar", req.body);
    var id = parseInt(req.params.id);

    var sqlCheck = "SELECT * FROM gestores WHERE id = ?";
    conexion.query(sqlCheck, [id], function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");
        if (resultados.length === 0) return res.status(404).json("Gestor no encontrado");

        if (req.body.usuario) {
            var sqlUserCheck = "SELECT * FROM gestores WHERE usuario = ? AND id != ?";
            conexion.query(sqlUserCheck, [req.body.usuario, id], function(err, resUser) {
                if (err) return res.status(500).json("Error en la base de datos");
                if (resUser.length > 0) return res.status(403).json("Ese usuario ya existe");

                ejecutarUpdate();
            });
        } else {
            ejecutarUpdate();
        }
    });

    function ejecutarUpdate() {
        var sqlUpdate = "UPDATE gestores SET nombre = COALESCE(?, nombre), apellidos = COALESCE(?, apellidos), usuario = COALESCE(?, usuario), password = COALESCE(?, password) WHERE id = ?";
        var valores = [req.body.nombre || null, req.body.apellidos || null, req.body.usuario || null, req.body.password || null, id];

        conexion.query(sqlUpdate, valores, function(err, resultado) {
            if (err) return res.status(500).json("Error al actualizar el gestor");
            console.log("Gestor actualizado ID:", id);
            res.status(200).json("Gestor actualizado");
        });
    }
});

// GET : OBTENER DATOS DE UN GESTOR (SIN CONTRASEÑA)
app.get("/api/gestores/:id", function(req, res) {
    var id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json("Id no válido");

    var sql = "SELECT id, nombre, apellidos, usuario FROM gestores WHERE id = ?";
    conexion.query(sql, [id], function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");
        if (resultados.length === 0) return res.status(404).json("Gestor no encontrado");

        res.status(200).json(resultados[0]);
    });
});

// GET : OBTENER OBJETO CON LOS DATOS DE UN SANITARIO (SIN CONTRASEÑA)
app.get("/api/sanitarios/:id", function(req, res) {
    var id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json("Id no válido");

    var sql = "SELECT id, nombre, apellidos, usuario FROM sanitarios WHERE id = ?";
    conexion.query(sql, [id], function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");
        if (resultados.length === 0) return res.status(404).json("Sanitario no encontrado");

        res.status(200).json(resultados[0]);
    });
});

// GET: OBTENER TODOS LOS RECURSOS (CON FILTROS OPCIONALES)
app.get("/api/recursos", function(req, res) {
    var sql = "SELECT r.* FROM recursos r";
    var condiciones = [];
    var valores = [];

    if (req.query.categoria) {
        sql += " JOIN modelos m ON r.modelo = m.id";
        condiciones.push("m.categoria = ?");
        valores.push(req.query.categoria);
    }

    if (req.query.modelo) {
        condiciones.push("r.modelo = ?");
        valores.push(req.query.modelo);
    }

    if (req.query.ubicacion) {
        condiciones.push("r.ubicacion = ?");
        valores.push(req.query.ubicacion);
    }

    if (req.query.estado != null && req.query.estado !== "") {
        condiciones.push("r.estado = ?");
        valores.push(req.query.estado);
    }

    if (condiciones.length > 0) {
        sql += " WHERE " + condiciones.join(" AND ");
    }

    conexion.query(sql, valores, function(err, resultados) {
        if (err) {
            console.log("Error al filtrar recursos:", err);
            return res.status(500).json("Error en la base de datos");
        }
        res.status(200).json(resultados);
    });
});

// GET : OBTIENE LOS DATOS DE UN RECURSO POR ID
app.get("/api/recursos/:id", function(req, res) {
    var id = parseInt(req.params.id);
    var sql = "SELECT * FROM recursos WHERE id = ?";
    
    conexion.query(sql, [id], function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");
        if (resultados.length === 0) return res.status(404).json("Recurso no encontrado");
        
        res.status(200).json(resultados[0]);
    });
});

// POST : CREA UN RECURSO
app.post("/api/recursos", function(req, res) {
    var sql = "INSERT INTO recursos (modelo, ubicacion, numero_serie, estado) VALUES (?, ?, ?, ?)";
    var valores = [req.body.modelo, req.body.ubicacion, req.body.numero_serie, req.body.estado];

    conexion.query(sql, valores, function(err, resultado) {
        if (err) return res.status(500).json("Error al crear el recurso");
        res.status(201).json("Recurso creado");
    });
});

// PUT : ACTUALIZA UN RECURSO
app.put("/api/recursos/:id", function(req, res) {
    var recursoId = parseInt(req.params.id);

    var sql = "UPDATE recursos SET modelo = COALESCE(?, modelo), ubicacion = COALESCE(?, ubicacion), numero_serie = COALESCE(?, numero_serie), estado = COALESCE(?, estado) WHERE id = ?";
    var valores = [
        req.body.modelo || null,
        req.body.ubicacion || null,
        req.body.numero_serie || null,
        req.body.estado != null ? req.body.estado : null,
        recursoId
    ];

    conexion.query(sql, valores, function(err, resultado) {
        if (err) return res.status(500).json("Error al actualizar el recurso");
        if (resultado.affectedRows === 0) return res.status(404).json("Recurso no encontrado");
        
        res.status(200).json("Recurso actualizado");
    });
});

// DELETE : BORRA UN RECURSO
app.delete("/api/recursos/:id", function(req, res) {
    var id = parseInt(req.params.id);
    var sql = "DELETE FROM recursos WHERE id = ?";

    conexion.query(sql, [id], function(err, resultado) {
        if (err) return res.status(500).json("Error al borrar el recurso");
        if (resultado.affectedRows === 0) return res.status(404).json("Recurso no encontrado");
        
        res.status(200).json("Recurso borrado");
    });
});

// GET: OBTIENE LAS RESERVAS DE UN RECURSO
app.get("/api/recursos/:id/reservas", function(req, res) {
    var id = parseInt(req.params.id);
    var sql = "SELECT * FROM reservas WHERE recurso = ?";

    conexion.query(sql, [id], function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");
        res.status(200).json(resultados);
    });
});

// GET: OBTIENE LAS RESEÑAS DE UN RECURSO
app.get("/api/recursos/:id/resenyas", function(req, res) {
    var id = parseInt(req.params.id);
    var sql = "SELECT * FROM resenyas WHERE recurso = ?";

    conexion.query(sql, [id], function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");
        res.status(200).json(resultados);
    });
});



// GET: Obtener todos los gestores
app.get("/api/gestores", function(req, res) {
    conexion.query("SELECT id, nombre, apellidos, usuario FROM gestores", function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");
        res.status(200).json(resultados);
    });
});

// GET: Obtener todos los sanitarios
app.get("/api/sanitarios", function(req, res) {
    conexion.query("SELECT id, nombre, apellidos, usuario FROM sanitarios", function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");
        res.status(200).json(resultados);
    });
});

// GET: Obtener todas las reservas
app.get("/api/reservas", function(req, res) {
    conexion.query("SELECT * FROM reservas", function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");
        res.status(200).json(resultados);
    });
});

// GET: Obtener todas las reseñas
app.get("/api/resenyas", function(req, res) {
    conexion.query("SELECT * FROM resenyas", function(err, resultados) {
        if (err) return res.status(500).json("Error en la base de datos");
        res.status(200).json(resultados);
    });
});

app.use(express.static(__dirname + "/Cliente"));

app.listen(3000, function(){
    console.log("Servidor arrancado en puerto 3000");
});

