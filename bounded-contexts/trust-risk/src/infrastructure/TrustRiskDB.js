'use strict';

const { MongoTrustEventStore }          = require('./eventStore/MongoTrustEventStore');
const { MongoTrustProfileRepository }   = require('./repositories/MongoTrustProfileRepository');
const { MongoRiskCaseRepository }       = require('./repositories/MongoRiskCaseRepository');
const { MongoPolicyRegistry }           = require('./repositories/MongoPolicyRegistry');
const { MongoEvidenceStore }            = require('./persistence/mongo/MongoEvidenceStore');
const { MongoExplanationStore }         = require('./persistence/mongo/MongoExplanationStore');
const { MongoOperationalAssessmentStore } = require('./persistence/mongo/MongoOperationalAssessmentStore');
const { SnapshotStore }                 = require('./eventStore/SnapshotStore');
const { UnitOfWork }                    = require('./bus/UnitOfWork');
const { SystemClock }                   = require('./clock/SystemClock');

/**
 * TrustRiskDB — fábrica de toda la infraestructura del bounded context.
 *
 * Uso desde el Kernel:
 *   const tr = await TrustRiskDB.initialize(mongoDb, sinapsisPublisher);
 *   const uow = tr.createUnitOfWork();
 *
 * ADR-001: completamente desacoplado del resto del Kernel.
 * El Kernel solo conoce esta fábrica y los puertos de dominio.
 */
class TrustRiskDB {

  constructor({ eventStore, profileRepo, riskCaseRepo, policyRegistry,
                evidenceStore, explanationStore, assessmentStore,
                snapshotStore, publisher, clock }) {
    this.eventStore      = eventStore;
    this.profileRepo     = profileRepo;
    this.riskCaseRepo    = riskCaseRepo;
    this.policyRegistry  = policyRegistry;
    this.evidenceStore   = evidenceStore;
    this.explanationStore = explanationStore;
    this.assessmentStore = assessmentStore;
    this.snapshotStore   = snapshotStore;
    this.publisher       = publisher;
    this.clock           = clock;
  }

  createUnitOfWork() {
    return new UnitOfWork({
      trustProfileRepository: this.profileRepo,
      riskCaseRepository:     this.riskCaseRepo,
      publisher:              this.publisher,
    });
  }

  static async initialize(db, publisher) {
    const clock          = new SystemClock();
    const eventStore     = new MongoTrustEventStore(db);
    const snapshotStore  = new SnapshotStore(db);
    const profileRepo    = new MongoTrustProfileRepository(eventStore, db);
    const riskCaseRepo   = new MongoRiskCaseRepository(eventStore, db);
    const policyRegistry = new MongoPolicyRegistry(db);
    const evidenceStore  = new MongoEvidenceStore(db);
    const explanationStore = new MongoExplanationStore(db);
    const assessmentStore  = new MongoOperationalAssessmentStore(db);

    // Crear índices y sembrar política inicial
    await Promise.all([
      eventStore.ensureIndexes(),
      snapshotStore.ensureIndexes(),
      profileRepo.ensureIndexes(),
      riskCaseRepo.ensureIndexes(),
      policyRegistry.ensureIndexes(),
      evidenceStore.ensureIndexes(),
      explanationStore.ensureIndexes(),
      assessmentStore.ensureIndexes(),
    ]);

    await policyRegistry.seed();

    return new TrustRiskDB({
      eventStore, profileRepo, riskCaseRepo, policyRegistry,
      evidenceStore, explanationStore, assessmentStore,
      snapshotStore, publisher, clock,
    });
  }
}

module.exports = { TrustRiskDB };
