'use strict';

var soap = require('soap');
var _ = require('lodash');
var fs = require('fs');
var async = require('async');
var Item = require('./item');
var JOURNAL_INTERVAL = 20;
var EVENT_EMIT_INTERVAL = 100;
var RELOGIN_INTERVAL = 15 * 60 * 1000;
var GET_ITEMS_CHUNK_SIZE = 25;
var ROW_ENV = 'ROW_ENV';

class AllegroClient {
    constructor(options, eventType) {
        this.eventType = eventType;
        this.fastForwarded = false;
        this.options = options || {};
        this.soapClient = options.soapClient;
        this.sessionHandle = null;
        this.oldestRowId = this.getLastRowId();
    }
    static createClient(options, eventType, callback) {
        soap.createClient(options.wsdl, function (err, client) {
            if (err) {
                callback(err);
            } else {
                callback(null, new AllegroClient({
                    soapClient: client,
                    key: options.key,
                    countryId: options.countryId,
                    login: options.login,
                    password: options.password,
                    passwordHash: options.passwordHash
                }, eventType));
            }
        });
    };

    loginUser(callback) {
        var self = this;
        if (this.sessionHandle) {
            callback(null, this.sessionHandle);
        } else {
            this.soapClient.doQuerySysStatus({
                'sysvar': 3,
                'countryId': this.options.countryId,
                'webapiKey': this.options.key
            }, (err, result) => {
                    self.soapClient.doLogin({
                        'userLogin': self.options.login,
                        'userPassword': self.options.passwordHash,
                        'countryCode': self.options.countryId,
                        'webapiKey': self.options.key,
                        'localVersion': result.verKey
                    }, (err, result) => {
                        if(err!=null){
                            console.log('LOGIN ERROR: ' + err);
                            callback(err, null);
                        }else if(result!=null) {
                            console.log('Login: ' + result.sessionHandlePart);
                            self.sessionHandle = result.sessionHandlePart;
                            callback(err, result.sessionHandlePart);
                        } else {
                            console.log('nulls');
                            callback(err, result);
                        }
                    });
            });
        }
    };
    
    startPooling(io) {
        var self = this;
        this.io = io;
        self.counter = 0;
        self.poolJournal();
        //setInterval(() => self.loginUser(() => {}), RELOGIN_INTERVAL);
    };
    
    poolJournal() {
        var self = this;
        this.loginUser((err, sessionKey) => {      
            self.soapClient.doGetSiteJournal(self.getJournalArgs(sessionKey), (err, result) => {
                if (err) {
                    if (JSON.stringify(err).indexOf('ERR_NO_SESSION') > -1) {
                        console.log('Session expired, relogging...');
                        self.sessionHandle = null;
                        self.loginUser((err, res) => {
                            self.poolJournal();
                        });
                    } else {
                        console.log(self.oldestRowId + ' doGetSiteJournal ERROR: ' + err.code || JSON.stringify(err));
                        self.scheduleJournalDownload();
                    }
                } else {
                    if (result.siteJournalArray != null && !self.fastForwarded && result.siteJournalArray.item.length == 100) {
                        self.scheduleJournalDownload(1);
                        self.oldestRowId = _.last(result.siteJournalArray.item).rowId;
                        if(++self.counter > 50 ){
                            self.counter = 0;
                            console.log(`[${self.oldestRowId}] on ${new Date(_.last(result.siteJournalArray.item).changeDate*1000)}`);
                        }
                        return;
                    } else if (result.siteJournalArray != null && result.siteJournalArray.item.length > 0) {
                        if(!self.fastForwarded) self.fastForwarded = true;
                        console.log(`[${self.oldestRowId}] ${result.siteJournalArray.item.length} items received`);
                        self.oldestRowId = _.last(result.siteJournalArray.item).rowId;
                        
                        var filtered = _.filter(result.siteJournalArray.item, x => x.changeType == self.eventType);
                        var chunks   = _.chunk(filtered, GET_ITEMS_CHUNK_SIZE);
                        self.saveLastRowId(self.oldestRowId);
                        async.eachSeries(chunks, 
                            (chunk, clb) => self.getItemsInfo(sessionKey, chunk, clb));
                    } else {
                        console.log('No items to display...');
                    }
                    self.scheduleJournalDownload();
                }
            });
        });
    }
    
    scheduleJournalDownload(overrideSpeed) {
        setTimeout(() => {
            this.poolJournal();
        }, overrideSpeed || JOURNAL_INTERVAL);
    }    
          
    getItemsInfo(sessionKey, items, clb){
        var argItems = _.map(items, item => parseFloat(item.itemId));
        var self = this;
        this.soapClient.doGetItemsInfo({
            'sessionHandle': sessionKey,
            'itemsIdArray': {item: argItems},
            'getImageUrl': 1}, 
            (err, result) => {
                if (err && result != null) {
                    console.log(err);
                } else if(result!=null) {
                    if (result.arrayItemListInfo != null && result.arrayItemListInfo.item.length > 0) {
                        console.log(`Received ${result.arrayItemListInfo.item.length} items`);
                        async.each(result.arrayItemListInfo.item, (i, clb) => self.emitMsg(i, self.eventType));
                        setTimeout(() => clb(), EVENT_EMIT_INTERVAL);
                    }
                } else {
                    console.log("null result for getItems");
                }
            });  
    }
    
    
    emitMsg(item, changeType) {
        var arg = new Item(item, changeType);
        this.io.emit('event', arg);        
    };  
    
    saveLastRowId(rowId) {
        fs.writeFile("./rowID.txt", rowId, (err) => {
            if (err)
                console.log(err);
        });
    }
    
    getLastRowId(clb) {
        return fs.readFileSync("./rowID.txt", 'utf8');
    }
    
    getJournalArgs(key){
        return {
                sessionHandle: key,
                startingPoint: this.oldestRowId ? parseFloat(this.oldestRowId) : null,
                infoType: 1
            };
    }
}

module.exports = AllegroClient;