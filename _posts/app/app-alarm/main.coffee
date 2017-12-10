getid = do (c=0) -> -> c++

init = -> $('body').html """
    <form id="form">

    </form>
    <ul id="list">
        <li v-for="item in list">
            {{ item.message }}
        </li>
    </ul>
"""

$ ->
    workerScriptText = $('script[type="text/webworker"]').text()
    workerScriptBlob = new Blob [workerScriptText], type: 'text/javascript'
    workerScriptUrl  = URL.createObjectURL workerScriptBlob

    window.worker = new Worker workerScriptUrl

    if Notification.permission isnt 'granted'
        console.log Notification.permission
        Notification.requestPermission (permission) ->
            if permission isnt 'granted'
                $('body').html "Well, I can't alarm you if you don't allow me"
            else
                do init
    else
        do init

    list = new Vue
        el: '#list'

    $('#at').click ->
        worker.postMessage({a: 2})
