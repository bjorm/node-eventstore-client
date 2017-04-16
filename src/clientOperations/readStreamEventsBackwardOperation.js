var util = require('util');
var uuid = require('uuid');

var TcpCommand = require('../systemData/tcpCommand');
var ClientMessage = require('../messages/clientMessage');
var ReadDirection = require('../readDirection');
var StatusCode = require('../systemData/statusCode');
var InspectionResult = require('./../systemData/inspectionResult');
var InspectionDecision = require('../systemData/inspectionDecision');
var results = require('../results');
var AccessDeniedError = require('../errors/accessDeniedError');

var OperationBase = require('./operationBase');

function ReadStreamEventsBackwardOperation(
    log, cb, stream, fromEventNumber, maxCount, resolveLinkTos, requireMaster, userCredentials
) {
  OperationBase.call(this, log, cb, TcpCommand.ReadStreamEventsBackward, TcpCommand.ReadStreamEventsBackwardCompleted, userCredentials);
  this._responseType = ClientMessage.ReadStreamEventsCompleted;

  this._stream = stream;
  this._fromEventNumber = fromEventNumber;
  this._maxCount = maxCount;
  this._resolveLinkTos = resolveLinkTos;
  this._requireMaster = requireMaster;
}
util.inherits(ReadStreamEventsBackwardOperation, OperationBase);

ReadStreamEventsBackwardOperation.prototype._createRequestDto = function() {
  return new ClientMessage.ReadStreamEvents({
      eventStreamId: this._stream,
      fromEventNumber: this._fromEventNumber,
      maxCount: this._maxCount,
      resolveLinkTos: this._resolveLinkTos,
      requireMaster: this._requireMaster
  });
};

ReadStreamEventsBackwardOperation.prototype._inspectResponse = function(response) {
  switch (response.result)
  {
    case ClientMessage.ReadStreamEventsCompleted.ReadStreamResult.Success:
      this._succeed();
      return new InspectionResult(InspectionDecision.EndOperation, "Success");
    case ClientMessage.ReadStreamEventsCompleted.ReadStreamResult.StreamDeleted:
      this._succeed();
      return new InspectionResult(InspectionDecision.EndOperation, "StreamDeleted");
    case ClientMessage.ReadStreamEventsCompleted.ReadStreamResult.NoStream:
      this._succeed();
      return new InspectionResult(InspectionDecision.EndOperation, "NoStream");
    case ClientMessage.ReadStreamEventsCompleted.ReadStreamResult.Error:
      this.fail(new Error("Server error: " + response.error));
      return new InspectionResult(InspectionDecision.EndOperation, "Error");
    case ClientMessage.ReadStreamEventsCompleted.ReadStreamResult.AccessDenied:
      this.fail(new AccessDeniedError("Read", this._stream));
      return new InspectionResult(InspectionDecision.EndOperation, "AccessDenied");
    default:
      throw new Error(util.format("Unexpected ReadStreamResult: %s.", response.result));
  }
};

ReadStreamEventsBackwardOperation.prototype._transformResponse = function(response) {
  return new results.StreamEventsSlice(
      StatusCode.convert(response.result),
      this._stream,
      this._fromEventNumber,
      ReadDirection.Backward,
      response.events,
      response.nextEventNumber,
      response.lastEventNumber,
      response.isEndOfStream
  )
};

ReadStreamEventsBackwardOperation.prototype.toString = function() {
  return util.format("Stream: %s, FromEventNumber: %d, MaxCount: %d, ResolveLinkTos: %s, RequireMaster: %s",
      this._stream, this._fromEventNumber, this._maxCount, this._resolveLinkTos, this._requireMaster);
};

module.exports = ReadStreamEventsBackwardOperation;
