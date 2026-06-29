# MODELOS MONGODB
> 2026-06-28 20:06

## models/ActivityLog.js
Modelo: `ActivityLog`

Campos:
      type: String,
      enum: [
      type: String,
      enum: ['pulse','productos','ventas','clientes','proveedores','mostrador','caja','automatizaciones','sistema'],
      default: 'sistema'
      tipo:   { type: String, enum: ['gia','comerciante','sistema','cliente','empleado'], default: 'sistema' },
      nombre: { type: String, default: 'Sistema' },
      type: String,
      enum: ['info','propuesta','automatico','requiere_confirmacion'],
      default: 'info'
      type: String,
      enum: ['informativo','pendiente','aprobado','rechazado','ejecutado','error'],
      default: 'informativo'
    errorCode:          { type: String },
    errorMessage:       { type: String },
    accionUrl:  { type: String },
    timestamp:  { type: Date, default: Date.now }
  + timestamps (createdAt, updatedAt)

## models/AuctionOutcome.js
Modelo: `AuctionOutcome`

Campos:
      moneda:      { type: String, default: "ARS" },
      rubroId:     { type: String },
      zonaId:      { type: String },
      enviadaEn:   { type: Date },
      tiempoRespuestaMs: { type: Number },
      selected:    { type: Boolean, default: false },
      rubroId:          { type: String },
      zonaId:           { type: String },
      totalParticipantes: { type: Number, default: 0 },
      precioMinimo:     { type: Number },
      precioMaximo:     { type: Number },
      precioPromedio:   { type: Number },
      posicionPrecioGanador: { type: Number },
      version: { type: Number, default: 1 },
      collection: "auction_outcomes",
      timestamps: { createdAt: "creadaEn", updatedAt: "actualizadaEn" },

## models/BusinessProfile.js
Modelo: `BusinessProfile`

Campos:
    apertura: String,
    cierre:   String,
    cerrado:  { type: Boolean, default: false }
      ref: 'Usuario',
      unique: true,
      index: true
      ref: 'Commerce',
      default: null,
      index: true
    razonSocial:     { type: String, trim: true },
    cuit:            { type: String, trim: true, match: /^\d{2}-\d{8}-\d{1}$/ },
    direccion: { type: String, trim: true },
    localidad: { type: String, trim: true },
    zonaId:    { type: String, index: true },
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }
    logo:    { type: String, default: null },
    banner:  { type: String, default: null },
    galeria: [String],
    whatsapp:  { type: String, trim: true },
    website:   { type: String, trim: true },
    instagram: { type: String, trim: true },
      type:    String,
      enum:    ['DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED'],
      default: 'DRAFT',

## models/CatalogItem.js
Modelo: `CatalogItem`

Campos:
    descripcion:  { type: String, trim: true, maxlength: 1000 },
    sku:          { type: String, trim: true },
    moneda:       { type: String, default: 'ARS' },
    categoria:    { type: String },
    tags:         [String],
    disponible:   { type: Boolean, default: true, index: true },
    imagenPrincipal: String,
    enPromocion:  { type: Boolean, default: false },
    precioPromo:  { type: Number },
    promoHasta:   { type: Date },
    estado:       { type: String, enum: ['ACTIVO','PAUSADO','BORRADOR'], default: 'ACTIVO', index: true },
    activoDesde:  { type: Date, default: Date.now },
    ultimaVenta:  { type: Date, default: null },
      vistas:     { type: Number, default: 0 },
      consultas:  { type: Number, default: 0 },
      ventas:     { type: Number, default: 0 }
    creadoEn:     { type: Date, default: Date.now },
    actualizadoEn:{ type: Date, default: Date.now }
    collection: 'catalog_items',
    timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' }

## models/CatalogoItem.js
Modelo: `CatalogoItem`

Campos:
    subcategoria:   { type: String },
    marca:          { type: String },
    unidad:         { type: String, default: 'm2' },
    activo:         { type: Boolean, default: true },
    createdAt:      { type: Date, default: Date.now },
    updatedAt:      { type: Date, default: Date.now }

## models/Event.js
Modelo: `Event`

Campos:
    zoneId: { type: String, index: true },
    source: { type: String, enum: DEMAND_SOURCES },
      type: String,
      enum: ['RawDemand', 'VerifiedDemand', 'Rejected'],
      default: 'RawDemand'
    schemaVersion: { type: Number, default: SCHEMA_VERSION },
    constitutionVersion: { type: String, default: CONSTITUTION_VERSION }
  + timestamps (createdAt, updatedAt)

## models/GiaConversation.js
Modelo: `GiaConversation`

Campos:
    timestamp: { type: Date, default: Date.now }
    ultimaActividad: { type: Date, default: Date.now }
  + timestamps (createdAt, updatedAt)

## models/IdempotencyRecord.js
Modelo: `IdempotencyRecord`

Campos:
    rejectionReason: { type: String, default: null },
    processedAt: { type: Date, default: Date.now },

## models/MarketingEvent.js

Campos:

## models/MerchantProjection.js
Modelo: `MerchantProjection`

Campos:
    nombreComercial: String,
    estado:          String,
    verificado:      Boolean,
    logo:            String,
    zonaId:          String,
    rubroId:         String,
      vistasHoy:           { type: Number, default: 0 },
      vistasUltimos7dias:  { type: Number, default: 0 },
      vistasUltimos30dias: { type: Number, default: 0 },
      solicitudesHoy:      { type: Number, default: 0 },
      pedidosConcretados:  { type: Number, default: 0 },
      calificacionPromedio:{ type: Number, default: 0 },
      ingresosEstimadoMes: { type: Number, default: 0 },
      boostActivos:        { type: Number, default: 0 }
      totalItems:    { type: Number, default: 0 },
      enPromocion:   { type: Number, default: 0 },
      sinStock:      { type: Number, default: 0 },
      conversionRate:           { type: Number, default: 0 },
      solicitudesUltimos7diasSerie: { type: Array, default: [] }
      activas:         { type: Number, default: 0 },
      vistasGeneradas: { type: Number, default: 0 },
      conversionRate:  { type: Number, default: 0 }
    reconstruidaEn:        { type: Date,   default: Date.now },
    actualizadaEn:         { type: Date,   default: Date.now }
    collection: 'merchant_projections',

## models/Pedido.js

Campos:

## models/PolicyRule.js
Modelo: `PolicyRule`

Campos:
      type: String,
      enum: ['active', 'shadow', 'frozen', 'deprecated'],
      default: 'shadow',
      index: true,
        from: { type: Number, min: 0, max: 23 },
        to:   { type: Number, min: 0, max: 23 },
    rollbackable:      { type: Boolean, default: true },
    activatedAt:{ type: Date },
    deprecatedAt:{ type: Date },
    timestamps: true,
    collection: 'policy_rules',
      ruleId:     this.ruleId,
      version:    this.version,
      conditions: this.conditions,
      actions:    this.actions,
      scope:      this.scope,
  + timestamps (createdAt, updatedAt)

## models/Quote.js
Modelo: `Quote`

Campos:
      moneda:       { type: String, default: "ARS" },
      descripcion:  { type: String },
      validezHasta: { type: Date },
      rubroId:      { type: String },
      zonaId:       { type: String },
        type: String,
        enum: ["created", "sent", "selected", "expired", "withdrawn", "rejected"],
        default: "created",
        index: true,
      creadaEn:     { type: Date },
      enviadaEn:    { type: Date },
      actualizadaEn:{ type: Date },
      seleccionadaEn:{ type: Date },
      expiradaEn:   { type: Date },
      retiradaEn:   { type: Date },
      ultimoEventoId:      { type: String },
      ultimoEventoTipo:    { type: String },
      version:             { type: Number, default: 0 },
      collection: "quotes",
      timestamps: { createdAt: "registradaEn", updatedAt: "modificadaEn" },

## models/TemporalAssuranceState.js
Modelo: `TemporalAssuranceState`

Campos:
    type:        { type: String, enum: ['NIGHT_PACT', 'TWO_HOUR_GATE', 'FINAL_CONFIRM'] },
    scheduledAt: Date,
    resolvedAt:  Date,
    resolution:  { type: String, enum: ['CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'TIMEOUT', 'PENDING'], default: 'PENDING' }
      type: String,
      enum: [
      default: 'AWAITING_NIGHT_PACT'
    frictionApplied: { type: Boolean, default: false },
    frictionAmountARS: { type: Number, default: 0 },
    frictionActor: { type: String, enum: ['CLIENTE', 'WORKER', 'NONE'], default: 'NONE' },
    reputationDelta: { type: Number, default: 0 },
    cancelledBy:  { type: String, enum: ['CLIENTE', 'WORKER', 'SISTEMA'] },
    cancelReason: String,
    resolvedAt:   Date,
    schemaVersion: { type: Number, default: 1 }
  + timestamps (createdAt, updatedAt)

## models/Usuario.js

Campos:

## models/WalEventArchive.js
Modelo: `WalEventArchive`

Campos:
    actorId:   { type: String, default: null },
    zoneId:    { type: String, default: null },
    archivedAt: { type: Date, default: Date.now }
    collection: 'wal_event_archive',
    strict: true

## models/ZoneMetrics.js
Modelo: `ZoneMetrics`

Campos:
    parentZoneId: { type: String, default: null },
    workersActivos:   { type: Number, default: 0 },
    commercesActivos: { type: Number, default: 0 },
    pedidosUltimas24h:  { type: Number, default: 0 },
    pedidosUltimaSemana:{ type: Number, default: 0 },
    ticketPromedioARS:  { type: Number, default: 0 },
    revenueUltimaSemanaARS: { type: Number, default: 0 },
    boostsActivos:    { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
    collection: 'geomesh_zones',
    timestamps: false

## models/worker.model.js
Modelo: `Worker`

Campos:
    reconnectTokenHash:      { type: String, select: false },
    reconnectTokenExpiresAt: { type: Date,   default: null },
    reconnectTokenVersion:   { type: Number, default: 0 },
    reconnectTokenIssuedAt:  { type: Date,   default: null },
    lastRestoreAt:           { type: Date,   default: null },
    lastRestoreIp:           { type: String, default: null },
    lastRestoreUserAgent:    { type: String, default: null },
    lastRestoreNetworkType:  { type: String, default: null },
    socketId:       { type: String, default: null },
    connectedAt:    { type: Date,   default: null },
    sessionVersion: { type: Number, default: 0 },
    reconnecting:   { type: Boolean, default: false },
    online:        { type: Boolean, default: false, index: true },
    lastHeartbeat: { type: Date,    default: null,  index: true },
    lastSeen:      { type: Date,    default: null },
    availability: { type: String, enum: ['DISPONIBLE','OCUPADO','PAUSA'], default: 'DISPONIBLE', index: true },
    zona:         { type: String,   index: true },
    rubros:       { type: [String], index: true },
    lat:       { type: Number },
    lng:       { type: Number },
    updatedAt: { type: Date }
    appVersion:   { type: String },
    platform:     { type: String },
    batteryLevel: { type: Number },
    networkType:  { type: String },

