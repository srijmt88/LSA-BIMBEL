const DATABASE_TABLES = [
  'students',
  'tutors',
  'schedules',
  'journals',
  'waReports',
  'invoices',
  'tutorEarnings'
];

function doGet() {
  return jsonResponse_({ service: 'LSA BIMBEL API', status: 'ready' });
}

function doPost(event) {
  try {
    const request = JSON.parse(event.postData.contents);
    const expectedSecret = PropertiesService.getScriptProperties()
      .getProperty('LSA_BIMBEL_API_SECRET');
    if (!expectedSecret || request.secret !== expectedSecret) {
      return jsonResponse_({ error: 'Permintaan tidak terotorisasi.' });
    }

    if (request.action === 'getDatabase') {
      return jsonResponse_(getDatabase());
    }
    if (request.action === 'saveDatabase') {
      return jsonResponse_(saveDatabase(request.data, request.expectedVersion));
    }
    return jsonResponse_({ error: 'Aksi API tidak dikenal.' });
  } catch (error) {
    return jsonResponse_({ error: error.message || 'Permintaan database gagal.' });
  }
}

function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getDatabase() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const spreadsheet = getDatabaseSpreadsheet_();
    const data = {};
    DATABASE_TABLES.forEach(function(tableName) {
      const sheet = spreadsheet.getSheetByName(tableName);
      if (!sheet) {
        throw new Error('Sheet database "' + tableName + '" tidak ditemukan.');
      }

      const lastRow = sheet.getLastRow();
      data[tableName] = [];
      if (lastRow < 2) return;

      const rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
      rows.forEach(function(row) {
        if (!row[1]) return;
        try {
          data[tableName].push(JSON.parse(row[1]));
        } catch (error) {
          throw new Error('Data pada sheet "' + tableName + '" tidak valid: ' + error.message);
        }
      });
    });

    const properties = PropertiesService.getScriptProperties();
    return {
      database: properties.getProperty('LSA_BIMBEL_DATABASE_INITIALIZED') === 'true' ? data : null,
      version: Number(properties.getProperty('LSA_BIMBEL_DATABASE_VERSION') || 0)
    };
  } finally {
    lock.releaseLock();
  }
}

function saveDatabase(data, expectedVersion) {
  validateDatabase_(data);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const currentVersion = Number(properties.getProperty('LSA_BIMBEL_DATABASE_VERSION') || 0);
    if (expectedVersion !== currentVersion) {
      throw new Error('Database telah berubah di sesi lain. Muat ulang aplikasi sebelum menyimpan perubahan berikutnya.');
    }

    const spreadsheet = getDatabaseSpreadsheet_();
    DATABASE_TABLES.forEach(function(tableName) {
      const sheet = spreadsheet.getSheetByName(tableName);
      if (!sheet) {
        throw new Error('Sheet database "' + tableName + '" tidak ditemukan.');
      }

      const rows = data[tableName].map(function(record, index) {
        return [record.id == null ? index + 1 : String(record.id), JSON.stringify(record)];
      });
      sheet.clearContents();
      sheet.getRange(1, 1, 1, 2).setValues([['id', 'record_json']]);
      if (rows.length) {
        sheet.getRange(2, 1, rows.length, 2).setValues(rows);
      }
    });
    properties.setProperties({
      LSA_BIMBEL_DATABASE_INITIALIZED: 'true',
      LSA_BIMBEL_DATABASE_VERSION: String(currentVersion + 1)
    });

    return { version: currentVersion + 1 };
  } finally {
    lock.releaseLock();
  }
}

function getDatabaseSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  let spreadsheetId = properties.getProperty('LSA_BIMBEL_DATABASE_ID');
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  const spreadsheet = SpreadsheetApp.create('LSA BIMBEL Database');
  const firstSheet = spreadsheet.getSheets()[0];
  firstSheet.setName(DATABASE_TABLES[0]);
  DATABASE_TABLES.slice(1).forEach(function(tableName) {
    spreadsheet.insertSheet(tableName);
  });
  DATABASE_TABLES.forEach(function(tableName) {
    spreadsheet.getSheetByName(tableName).getRange(1, 1, 1, 2)
      .setValues([['id', 'record_json']]);
  });
  properties.setProperty('LSA_BIMBEL_DATABASE_ID', spreadsheet.getId());
  return spreadsheet;
}

function validateDatabase_(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Data database tidak valid.');
  }

  DATABASE_TABLES.forEach(function(tableName) {
    if (!Array.isArray(data[tableName])) {
      throw new Error('Tabel "' + tableName + '" harus berupa array.');
    }
    data[tableName].forEach(function(record, index) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        throw new Error('Record ke-' + (index + 1) + ' pada "' + tableName + '" tidak valid.');
      }
    });
  });
}
