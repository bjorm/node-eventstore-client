var util = require('util');
var uuid = require('uuid');

var TcpCommand = require('../systemData/tcpCommand');
var InspectionDecision = require('../systemData/inspectionDecision');
var InspectionResult = require('./../systemData/inspectionResult');
var ClientMessage = require('../messages/clientMessage');
var EventStoreTransaction = require('../eventStoreTransaction');
var results = require('../results');

var OperationBase = require('../clientOperations/operationBase');

function StartTransactionOperation(log, cb, requireMaster, stream, expectedVersion, parentConnection, userCredentials) {
  OperationBase.call(this, log, cb, TcpCommand.TransactionStart, TcpCommand.TransactionStartCompleted, userCredentials);
  this._responseType = ClientMessage.TransactionStartCompleted;

  this._requireMaster = requireMaster;
  this._stream = stream;
  this._expectedVersion = expectedVersion;
  this._parentConnection = parentConnection;
}
util.inherits(StartTransactionOperation, OperationBase);

StartTransactionOperation.prototype._createRequestDto = function() {
  return new ClientMessage.TransactionStart(this._stream, this._expectedVersion, this._requireMaster);
};

StartTransactionOperation.prototype._inspectResponse = function(response) {
  switch (response.result)
  {
    case ClientMessage.OperationResult.Success:
      this._succeed();
      return new InspectionResult(InspectionDecision.EndOperation, "Success");
    case ClientMessage.OperationResult.PrepareTimeout:
      return new InspectionResult(InspectionDecision.Retry, "PrepareTimeout");
    case ClientMessage.OperationResult.CommitTimeout:
      return new InspectionResult(InspectionDecision.Retry, "CommitTimeout");
    case ClientMessage.OperationResult.ForwardTimeout:
      return new InspectionResult(InspectionDecision.Retry, "ForwardTimeout");
    case ClientMessage.OperationResult.WrongExpectedVersion:
      var err = util.format("Start transaction failed due to WrongExpectedVersion. Stream: %s, Expected version: %d.", this._stream, this._expectedVersion);
      this.fail(new Error(err));
      return new InspectionResult(InspectionDecision.EndOperation, "WrongExpectedVersion");
    case ClientMessage.OperationResult.StreamDeleted:
      this.fail(new Error("Stream deleted: " + this._stream));
      return new InspectionResult(InspectionDecision.EndOperation, "StreamDeleted");
    case ClientMessage.OperationResult.InvalidTransaction:
      this.fail(new Error("Invalid transaction."));
      return new InspectionResult(InspectionDecision.EndOperation, "InvalidTransaction");
    case ClientMessage.OperationResult.AccessDenied:
      this.fail(new Error(util.format("Write access denied for stream '%s'.", this._stream)));
      return new InspectionResult(InspectionDecision.EndOperation, "AccessDenied");
    default:
      throw new Error(util.format("Unexpected OperationResult: %s.", response.result));
  }
};

StartTransactionOperation.prototype._transformResponse = function(response) {
  return new EventStoreTransaction(results.toNumber(response.transaction_id), this.userCredentials, this._parentConnection);
};

StartTransactionOperation.prototype.toString = function() {
  return util.format("Stream: %s, ExpectedVersion: %d", this._stream, this._expectedVersion);
};

module.exports = StartTransactionOperation;
