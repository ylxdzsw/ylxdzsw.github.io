getid = do (c=0) -> -> c++

$ ->
    if Notification.permission isnt 'granted'
        Notification.requestPermission (permission) ->
            if permission isnt 'granted'
                $('body').html "Well, I can't alarm you if you don't allow me"
            else
                do init
    else
        do init

init = ->
    $('body').html """
        <div id="time">current time: </div>
        <form id="form" onsubmit="return false">
            <input type="number" id="hour"   value="0" /> :
            <input type="number" id="minute" value="0" /> :
            <input type="number" id="second" value="0" />
            <input type="text" id="message"  value="alarm!" />
            <input type="submit" id="at"     value="At" />
            <input type="submit" id="later"  value="Later" />
            <input type="submit" id="after"  value="After Last" />
        </form>
        <ul id="list">
            <li v-for="alarm in alarms">
                {{ alarm.time.toTimeString().slice(0,8) }}: {{ alarm.message }}
                <button class="cancel" v-on:click="cancel(alarm)"> cancel </button>
            </li>
        </ul>
    """

    workerScriptText = $('script[type="text/webworker"]').text()
    workerScriptBlob = new Blob [workerScriptText], type: 'text/javascript'
    workerScriptUrl  = URL.createObjectURL workerScriptBlob

    worker = new Worker workerScriptUrl
    worker.onmessage = ({data}) ->
        switch data.action
            when 'add'
                app.alarms.push data
                app.alarms.sort (x, y) -> x.time - y.time
            when 'cancel'
                index = app.alarms.findIndex (x) -> x.id is data.id
                app.alarms.splice index, 1
            when 'finish'
                do app.alarms.shift
            else
                console.error "unknown action"

    app = new Vue
        el: '#list'
        data:
            alarms: []
        methods:
            cancel: (alarm) ->
                worker.postMessage action: 'cancel', id: alarm.id

    $('#at').click ->
        now = new Date()
        a = new Date(now)
        a.setHours parseInt $('#hour').val()
        a.setMinutes parseInt $('#minute').val()
        a.setSeconds parseInt $('#second').val()

        tp = a - now
        tp += 24 * 60 * 60 * 1000 if tp < 0

        worker.postMessage
            action: 'add'
            id: getid()
            timeout: tp
            message: $('#message').val()

    $('#later').click ->
        h = parseInt $('#hour').val()
        m = parseInt $('#minute').val()
        s = parseInt $('#second').val()

        worker.postMessage
            action: 'add'
            id: getid()
            timeout: 1000 * (60 * (60 * h + m) + s)
            message: $('#message').val()

    $('#after').click ->
        h = parseInt $('#hour').val()
        m = parseInt $('#minute').val()
        s = parseInt $('#second').val()

        now = new Date
        len = app.alarms.length
        last = if len then app.alarms[len-1].time else now

        worker.postMessage
            action: 'add'
            id: getid()
            timeout: last - now + 1000 * (60 * (60 * h + m) + s)
            message: $('#message').val()

    window.onbeforeunload = (e) ->
        if app.alarms.length
            e.returnValue = "there are still awaiting alarms"

    displayCurrentTime = -> $('#time').text "current time: #{(new Date).toTimeString()[0...8]}"
    setInterval displayCurrentTime, 1000 # TODO: align to the start of a second
