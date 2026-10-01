import com.sap.gateway.ip.core.customdev.util.Message

def Message processData(Message message) {
    def messageLog =
        messageLogFactory.getMessageLog(message)

    def correlationId =
        message.getHeaders().get("X-Correlation-ID")

    if (messageLog != null && correlationId != null) {
        messageLog.addCustomHeaderProperty(
            "NHB_CorrelationId",
            correlationId.toString()
        )
    }

    return message
}