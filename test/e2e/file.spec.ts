import {bootstrap, component, Provider} from '@ziqquratu/ziqquratu';
import {Collection, DatabaseConfig, Database} from '@ziqquratu/database';
import {file, json} from '../../dist';
import {expect} from 'chai';
import 'mocha';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import * as fs from 'fs-extra';

chai.use(chaiAsPromised);
chai.use(sinonChai);

function storedDoc(id: string | number): any {
  return fs.readJsonSync(`test/e2e/testCollection.json`)[id];
}

function storedKeys() {
  return Object.keys(fs.readJsonSync(`test/e2e/testCollection.json`));
}

describe('file', () => {
  @component({
    dependencies: [import('../../dist')],
    providers: [
      Provider.ofInstance<DatabaseConfig>('ziqquratu.DatabaseConfig', {
        collections: {
          'test': {
            source: file({
              path: 'test/e2e/testCollection.json',
              serializer: json(),
            })
          }
        },
      })
    ],
    inject: ['ziqquratu.Database'],
  })
  class TestComponent {
    public constructor(public database: Database) {}
  }

  let col: Collection;

  before(async () => {
    col = await (await bootstrap(TestComponent)).database.collection('test');
  });

  beforeEach(async () => {
    await col.insertMany([
      {_id: 1, item: { category: 'cake', type: 'chiffon' }, amount: 10 },
      {_id: 2, item: { category: 'cookies', type: 'chocolate chip'}, amount: 50 },
      {_id: 3, item: { category: 'cookies', type: 'chocolate chip'}, amount: 15 },
      {_id: 4, item: { category: 'cake', type: 'lemon' }, amount: 30 },
      {_id: 5, item: { category: 'cake', type: 'carrot' }, amount: 20 },
    ]);
  });

  afterEach(async () => {
    await col.deleteMany({});
    // TODO: Collection interface needs this method.
    (col as any).removeAllListeners();
  });

  describe('insertOne', () => {
    it('should add a single document and give it an id', async () => {
      const doc = await col.insertOne(
        {item: { category: 'brownies', type: 'blondie' }, amount: 10 }
      );
      expect(doc.amount).to.eql(10);
      expect(doc).to.haveOwnProperty('_id');
      expect(storedDoc(doc._id))
        .to.eql({item: { category: 'brownies', type: 'blondie' }, amount: 10 });
    });
    it('should throw when trying to insert a document with already existing ID', () => {
      expect(col.insertOne(
        {_id: 1, item: { category: 'brownies', type: 'blondie' }, amount: 10 }
      )).to.eventually.be.rejected;
      expect(storedDoc(1))
        .to.eql({item: { category: 'cake', type: 'chiffon' }, amount: 10 });
    });
    it('should emit a document-upserted event', (done) => {
      col.on('document-upserted', (doc) => {
        expect(doc).to.eql({_id: 6, item: { category: 'brownies', type: 'blondie' }, amount: 10 });
        done();
      });
      col.insertOne(
        {_id: 6, item: { category: 'brownies', type: 'blondie' }, amount: 10 }
      );
    });
  });

  describe('insertMany', () => {
    it('should add a multiple documents and give them ids', async () => {
      const docs = await col.insertMany([
        {item: { category: 'brownies', type: 'blondie' }, amount: 10 },
        {item: { category: 'brownies', type: 'baked' }, amount: 12 },
      ]);
      expect(docs.length).to.eql(2);
      expect(docs[0].amount).to.eql(10);
      expect(docs[1].amount).to.eql(12);
      expect(docs[0]).to.haveOwnProperty('_id');
      expect(docs[1]).to.haveOwnProperty('_id');
      expect(storedDoc(docs[0]._id))
        .to.eql({item: { category: 'brownies', type: 'blondie' }, amount: 10 });
      expect(storedDoc(docs[1]._id))
        .to.eql({item: { category: 'brownies', type: 'baked' }, amount: 12 });
    });
    it('should throw when trying to insert a document with already existing ID', () => {
      return expect(col.insertMany([
        {item: { category: 'brownies', type: 'blondie' }, amount: 10 },
        {_id: 1, item: { category: 'brownies', type: 'baked' }, amount: 12 },
      ])).to.eventually.be.rejected;
    });
    it('should emit a document-upserted event for each document', async () => {
      const docs: any[] = [];
      col.on('document-upserted', (doc) => {
        docs.push(doc);
      });
      await col.insertMany([
        {item: { category: 'brownies', type: 'blondie' }, amount: 10 },
        {item: { category: 'brownies', type: 'baked' }, amount: 12 },
      ]);
      return expect(docs.length).to.eql(2);
    });
  });

  describe('replaceOne', () => {
    it('should update a single document', async () => {
      const doc = await col.replaceOne(
        {_id: 1}, {item: { category: 'brownies', type: 'blondie' }, amount: 20 }
      );
      expect(doc._id).to.eql(1);
      expect(doc.amount).to.eql(20);
      expect(storedDoc(1)).to.eql({item: { category: 'brownies', type: 'blondie' }, amount: 20 });
    });
    it('should return null if no document matched selector', async () => {
      const doc = await col.replaceOne(
        {_id: 6}, {item: { category: 'brownies', type: 'blondie' }, amount: 20 }
      );
      expect(doc).to.eql(null);
    });
    it('should completely replace document', async () => {
      const doc = await col.replaceOne(
        {_id: 1}, { amount: 20 }
      );
      expect(doc.item).to.eql(undefined);
      expect(storedDoc(1)).to.eql({ amount: 20 });
    });
    it('should upsert when specified', async () => {
      const doc = await col.replaceOne(
        {_id: 6}, { amount: 20 }, {upsert: true}
      );
      expect(doc.amount).to.eql(20);
      expect(storedDoc(doc._id)).to.eql({ amount: 20 });
    });
    it('should emit a document-upserted event', (done) => {
      col.on('document-upserted', (doc) => {
        expect(doc).to.eql({_id: 1, item: { category: 'brownies', type: 'blondie' }, amount: 20 });
        done();
      });
      col.replaceOne(
        {_id: 1}, {item: { category: 'brownies', type: 'blondie' }, amount: 20 }
      );
    });
  });

  describe('count', () => {
    it('should return 0 when no documents are matching', () => {
      expect(col.find({'item.category': 'candy'}).count()).to.eventually.eql(0);
    });
    it('should be a positive number when items are matched', async () => {
      expect(col.find({'item.category': 'cake'}).count()).to.eventually.eql(3);
    });
  });

  describe('findOne', () => {
    it('should return null when document is not found', () => {
      return expect(col.findOne({_id: 7})).to.eventually.eql(null);
    });
    it('should return the document when found', async () => {
      const doc = await col.findOne({_id: 1});
      expect(doc).to.haveOwnProperty('amount').equals(10);
    });
  });

  describe('find', () => {
    it('should return empty list when no documents match selector', () => {
      return expect(col.find({_id: 7}).toArray()).to.eventually.be.empty;
    });
    it('should return a list of matched documents', async () => {
      const docs = await col.find({'item.type': 'chiffon'}).toArray();
      expect(docs).to.have.length(1);
      expect(docs[0]).to.haveOwnProperty('_id').equal(1);
    });
    it('should handle query operators', async () => {
      const docs = await col.find({_id: {$in: [1, 2, 7]}}).toArray();
      expect(docs).to.have.length(2);
    });
    it('should do sorting with key', async () => {
      const docs = await col.find().sort('amount', 1).toArray();
      expect(docs[0].item.type).to.eql('chiffon');
    });
    it('should do sorting with map', async () => {
      const docs = await col.find().sort({'item.category': 1, 'item.type': 1}).toArray();
      expect(docs[0].item.type).to.eql('carrot');
    });
    it('should do sorting with array', async () => {
      const docs = await col.find().sort(['item.category', 'item.type'], 1).toArray();
      expect(docs[0].item.type).to.eql('carrot');
    });
    it('should do offset and limiting', async () => {
      const docs = await col.find().sort('amount', -1).skip(1).limit(1).toArray();
      expect(docs).to.have.length(1);
      expect(docs[0].item.type).to.eql('lemon');
    });
    it('should accept query options', async () => {
      const docs = await col.find({}, {sort: {amount: -1}, skip: 1, limit: 1}).toArray();
      expect(docs).to.have.length(1);
      expect(docs[0].item.type).to.eql('lemon');
    });
    it('should be able to iterate', async () => {
      const cursor = col.find().sort('amount', -1).skip(1).limit(1);
      expect(await cursor.hasNext()).to.be.true;
      expect((await cursor.next()).item.type).to.eql('lemon');
      expect(await cursor.hasNext()).to.be.false;
      expect(await cursor.next()).to.eql(null);
    });
  });

  describe('deleteOne', () => {
    it('should return null when no document match selector', () => {
      return expect(col.deleteOne({_id: 7})).to.eventually.be.null;
    });
    it('should return the deleted document', async () => {
      const doc = await col.deleteOne({_id: 1});
      expect(doc).to.eql({_id: 1, item: { category: 'cake', type: 'chiffon' }, amount: 10 });
    });
    it('should have removed selected document', async () => {
      const storedCount = storedKeys().length;
      await col.deleteOne({_id: 1});
      expect(col.findOne({_id: 1})).to.eventually.be.null;
      expect(storedKeys().length).to.eql(storedCount - 1);
      expect(storedKeys()).to.not.contain('1');
    });
    it('should emit a document-removed event if a document was removed', (done) => {
      col.on('document-removed', (doc) => {
        expect(doc).to.eql({_id: 1, item: { category: 'cake', type: 'chiffon' }, amount: 10 });
        done();
      });
      col.deleteOne({_id: 1});
    });
  });

  describe('deleteMany', () => {
    it('should return empty list when no documents match selector', () => {
      return expect(col.deleteMany({_id: 7})).to.eventually.be.empty;
    });
    it('should return a list of deleted documents', async () => {
      const storedCount = storedKeys().length;
      const docs = await col.deleteMany({'item.category': 'cookies'});
      expect(docs).to.have.length(2);
      expect(storedKeys().length).to.eql(storedCount - 2);
    });
    it('should have removed selected documents', async () => {
      await col.deleteMany({'item.category': 'cookies'});
      return expect(col.find({'item.category': 'cookies'}).count()).to.eventually.eql(0);
    });
    it('should not remove other documents', async () => {
      await col.deleteMany({'item.category': 'cookies'});
      return expect(col.find().count()).to.eventually.eql(3);
    });
  });
});